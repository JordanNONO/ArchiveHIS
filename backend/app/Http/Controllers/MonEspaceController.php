<?php

namespace App\Http\Controllers;

use App\Models\DocumentArchive;
use App\Models\Utilisateurs;
use App\Services\EcheancesDocuments;
use App\Services\SoldeCongesBulletin;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use ZipArchive;

/**
 * « Mes papiers » de l'espace intervenant — demande explicite 2026-11-22 :
 * le salarié retrouve sans rien demander ses bulletins de paie et TOUT ce
 * qui est classé à son nom (contrat, attestations, titre de séjour...), est
 * prévenu avant qu'un papier expire, et voit son solde de congés lu sur son
 * dernier bulletin.
 *
 * « Classé à son nom » = personnel_concerne_id parmi ses fiches Personnels,
 * plus ses propres dépôts auxquels la RH a donné une date de fin de validité
 * (le titre de séjour qu'il a déposé lui-même). La consultation d'un de ces
 * documents passe par les routes habituelles (/documents/{id}/meta,
 * lien-fichier), ouvertes à ce cas dans VisibiliteDocumentService::estVisiblePar().
 */
class MonEspaceController extends Controller
{
    private function personnelIds(Utilisateurs $user): Collection
    {
        return $user->personnels()->pluck('id');
    }

    private function mesDocuments(Utilisateurs $user): Collection
    {
        $personnelIds = $this->personnelIds($user);

        return DocumentArchive::with('typeDocument.parent', 'categorieDocument', 'personnelConcerne')
            ->where(function ($q) use ($user, $personnelIds) {
                $q->whereIn('personnel_concerne_id', $personnelIds)
                    ->orWhere(function ($q2) use ($user) {
                        $q2->where('utilisateur_id', $user->id)->whereNotNull('date_fin_validite');
                    });
            })
            // Dossier sous « gel administratif » : invisible, comme partout ailleurs.
            ->whereDoesntHave('categorieDocument', fn ($qc) => $qc->whereNotNull('verrouille_par_utilisateur_id'))
            ->orderByDesc('created_at')
            ->get();
    }

    private static function estBulletin(DocumentArchive $d): bool
    {
        if ($d->categorieDocument?->code !== 'ComptpaieFinance') {
            return false;
        }

        return $d->typeDocument?->libelle === 'Bulletin de paie'
            || $d->typeDocument?->parent?->libelle === 'Bulletin de paie';
    }

    /** Rubrique d'affichage dans « Mes documents ». */
    private static function rubrique(DocumentArchive $d): string
    {
        $famille = EcheancesDocuments::famille($d);
        if (in_array($famille, ['titre-sejour', 'identite'], true)) {
            return 'identite';
        }
        if (in_array($famille, ['visite-medicale', 'psc1', 'sst', 'formation', 'vaccin'], true)) {
            return 'sante';
        }

        $texte = Str::of($d->titre_document . ' ' . ($d->typeDocument?->libelle ?? '') . ' ' . ($d->typeDocument?->parent?->libelle ?? ''))->ascii()->lower();
        if ($texte->contains(['contrat', 'avenant', 'embauche', 'rupture'])) {
            return 'contrat';
        }
        if ($texte->contains(['attestation', 'mutuelle', 'prevoyance', 'certificat'])) {
            return 'attestations';
        }

        return 'autres';
    }

    private static function extension(DocumentArchive $d): string
    {
        return strtolower(pathinfo($d->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION));
    }

    private function enLigne(DocumentArchive $d): array
    {
        $jours = $d->date_fin_validite ? EcheancesDocuments::joursRestants($d) : null;

        return [
            'id' => $d->id,
            'titre' => $d->titre_document,
            'extension' => self::extension($d),
            'date' => ($d->date_archivage ?? $d->created_at)?->toDateString(),
            'mois_concerne' => $d->mois_concerne?->toDateString(),
            'date_fin_validite' => $d->date_fin_validite?->toDateString(),
            'jours_restants' => $jours,
        ];
    }

    /** GET /mon-espace/papiers */
    public function papiers()
    {
        $user = auth('api')->user();
        $documents = $this->mesDocuments($user);

        [$bulletins, $autres] = $documents->partition(fn ($d) => self::estBulletin($d));

        $bulletins = $bulletins
            ->sortByDesc(fn ($d) => ($d->mois_concerne ?? $d->created_at)->timestamp)
            ->values();

        // Solde : le premier bulletin (le plus récent) dont le texte se lit.
        // On ne remonte pas au-delà de 3 bulletins : un solde plus ancien
        // serait trompeur.
        $solde = null;
        foreach ($bulletins->take(3) as $bulletin) {
            $jours = SoldeCongesBulletin::lire($bulletin);
            if ($jours !== null) {
                $solde = [
                    'jours' => $jours,
                    'mois' => ($bulletin->mois_concerne ?? $bulletin->created_at)->toDateString(),
                    'document_id' => $bulletin->id,
                ];
                break;
            }
        }

        $actifs = EcheancesDocuments::nonRemplaces($documents)->pluck('id')->all();
        $echeances = $documents
            ->filter(fn ($d) => in_array($d->id, $actifs, true))
            ->map(fn ($d) => $this->enLigne($d))
            ->filter(fn ($l) => $l['jours_restants'] <= 60 && $l['jours_restants'] >= -EcheancesDocuments::OUBLI_APRES_JOURS)
            ->sortBy('jours_restants')
            ->values();

        return response()->json([
            'bulletins' => $bulletins->map(fn ($d) => $this->enLigne($d))->values(),
            'documents' => $autres->map(fn ($d) => $this->enLigne($d) + [
                'rubrique' => self::rubrique($d),
                // Un titre remplacé par un plus récent n'affiche plus d'alerte.
                'remplace' => $d->date_fin_validite !== null && !in_array($d->id, $actifs, true),
            ])->values(),
            'echeances' => $echeances,
            'solde_conges' => $solde,
        ], 200);
    }

    /** GET /mon-espace/bulletins/zip?annee=2025 — tous les bulletins d'une année en un fichier. */
    public function zipBulletins(Request $request)
    {
        $annee = (int) $request->validate(['annee' => 'required|integer|min:2000|max:2100'])['annee'];
        $user = auth('api')->user();

        $bulletins = $this->mesDocuments($user)
            ->filter(fn ($d) => self::estBulletin($d))
            ->filter(fn ($d) => (int) ($d->mois_concerne ?? $d->created_at)->format('Y') === $annee);

        if ($bulletins->isEmpty()) {
            return response()->json(['error' => 'Aucun bulletin pour cette année.'], 404);
        }

        $chemin = tempnam(sys_get_temp_dir(), 'bulletins');
        $zip = new ZipArchive();
        $zip->open($chemin, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $nomsPris = [];
        foreach ($bulletins as $d) {
            try {
                $contenu = $d->lireFichier();
            } catch (\Throwable $e) {
                report($e);
                continue;
            }
            $base = Str::slug(($d->mois_concerne ?? $d->created_at)->format('Y-m') . ' ' . $d->titre_document);
            $nom = $base . '.' . (self::extension($d) ?: 'pdf');
            $i = 2;
            while (isset($nomsPris[$nom])) {
                $nom = "{$base}-{$i}." . (self::extension($d) ?: 'pdf');
                $i++;
            }
            $nomsPris[$nom] = true;
            $zip->addFromString($nom, $contenu);
        }
        $zip->close();

        return response()->download($chemin, "bulletins-de-paie-{$annee}.zip", ['Content-Type' => 'application/zip'])
            ->deleteFileAfterSend(true);
    }
}
