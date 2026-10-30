<?php

namespace App\Services;

use App\Http\Controllers\PaiController;
use App\Models\CategorieDocument;
use App\Models\PaiDossier;
use App\Models\Utilisateurs;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Import des PAI publiés dans HisSAP (hisdocs_pai.php, lecture seule) vers le
 * module PAI. HisSAP reste la source du contenu (bénéficiaire, tuteur,
 * consignes) ; HisDocs garde le suivi (objectifs cochés, échéances, rappels).
 *
 * Un dossier = un client HisSAP (hissap_client_id). Une resynchro met à jour le
 * contenu et AJOUTE les nouveaux objectifs de soins, mais ne touche jamais au
 * titre, au responsable, ni aux objectifs déjà présents (cochés ou non).
 */
class HissapPaiService
{
    public const MOIS_ECHEANCE_PAR_DEFAUT = 3;

    public function estConfigure(): bool
    {
        return filled(config('services.hissap.url')) && filled(config('services.hissap.api_key'));
    }

    /** @return array<int, array> les PAI publiés, tels que renvoyés par HisSAP */
    public function recupererTous(): array
    {
        return $this->appeler([]);
    }

    public function recupererUn(int $hissapPaiId): ?array
    {
        return $this->appeler(['id' => $hissapPaiId])[0] ?? null;
    }

    private function appeler(array $parametres): array
    {
        if (!$this->estConfigure()) {
            throw new RuntimeException("La liaison HisSAP n'est pas configurée (HISSAP_URL / HISSAP_API_KEY).");
        }

        try {
            $reponse = Http::withHeaders(['X-API-Key' => config('services.hissap.api_key')])
                ->acceptJson()
                ->timeout(20)
                ->get(rtrim(config('services.hissap.url'), '/') . '/hisdocs_pai.php', $parametres);
        } catch (\Throwable $e) {
            throw new RuntimeException('HisSAP ne répond pas — réessayez dans un instant.');
        }

        if ($reponse->status() === 401) {
            throw new RuntimeException('HisSAP refuse la clé API — vérifiez HISSAP_API_KEY.');
        }
        if (!$reponse->successful() || !is_array($reponse->json('pais'))) {
            throw new RuntimeException('Réponse inattendue de HisSAP (code ' . $reponse->status() . ').');
        }

        return $reponse->json('pais');
    }

    public function empreinte(array $pai): string
    {
        return hash('sha256', json_encode($pai));
    }

    /** "nouveau" (pas encore importé), "modifie" (changé dans HisSAP depuis la synchro) ou "a_jour". */
    public function statut(array $pai, ?PaiDossier $dossier): string
    {
        if (!$dossier) {
            return 'nouveau';
        }
        return $dossier->hissap_empreinte === $this->empreinte($pai) ? 'a_jour' : 'modifie';
    }

    /**
     * Crée le dossier (ou le met à jour s'il existe déjà pour ce client HisSAP).
     *
     * @param array{mois_echeance?:int, donnees_sante?:bool} $options
     */
    public function importer(array $pai, Utilisateurs $par, array $options = []): PaiDossier
    {
        $moisEcheance = (int) ($options['mois_echeance'] ?? self::MOIS_ECHEANCE_PAR_DEFAUT);

        return DB::transaction(function () use ($pai, $par, $options, $moisEcheance) {
            $dossier = PaiDossier::where('hissap_client_id', $pai['client_id'])->lockForUpdate()->first();

            if (!$dossier) {
                $categorieId = CategorieDocument::where('libelle_cat', PaiController::LIBELLE_CATEGORIE_DEFAUT)->value('id');
                if (!$categorieId) {
                    throw new RuntimeException('Catégorie "' . PaiController::LIBELLE_CATEGORIE_DEFAUT . '" introuvable — contactez un administrateur.');
                }

                $nom = $this->nomBeneficiaire($pai);
                $dossier = PaiDossier::create([
                    'titre' => $this->titreLibre('PAI — ' . $nom, $pai['client_id']),
                    'nom_beneficiaire' => $nom,
                    'responsable_secteur_id' => $this->responsableSecteurId($pai) ?? $par->id,
                    'categorie_id' => $categorieId,
                    'description' => 'Importé de HisSAP.',
                    'date_ouverture' => $this->dateOuverture($pai),
                    'cree_par_id' => $par->id,
                    'hissap_client_id' => $pai['client_id'],
                ]);
                $avecSante = (bool) ($options['donnees_sante'] ?? false);
            } else {
                // Une resynchro garde le choix fait à l'import, sauf demande explicite.
                $avecSante = array_key_exists('donnees_sante', $options)
                    ? (bool) $options['donnees_sante']
                    : !empty($dossier->donnees_hissap['sante']);
            }

            $dossier->update([
                'hissap_pai_id' => $pai['id'],
                'donnees_hissap' => $this->donnees($pai, $avecSante),
                'hissap_empreinte' => $this->empreinte($pai),
                'synchronise_le' => now(),
            ]);

            $this->ajouterNouveauxObjectifs($dossier, $pai, $moisEcheance);

            return $dossier->fresh(['beneficiaire', 'responsableSecteur', 'objectifs']);
        });
    }

    /** @return bool true si le dossier a été mis à jour (false : déjà à jour, ou PAI plus publié) */
    public function resynchroniser(PaiDossier $dossier): bool
    {
        if (!$dossier->hissap_client_id) {
            return false;
        }

        $pai = collect($this->recupererTous())->firstWhere('client_id', $dossier->hissap_client_id);
        if (!$pai || $this->statut($pai, $dossier) === 'a_jour') {
            return false;
        }

        $this->importer($pai, $dossier->creePar ?? $dossier->responsableSecteur);
        return true;
    }

    private function ajouterNouveauxObjectifs(PaiDossier $dossier, array $pai, int $moisEcheance): void
    {
        $existants = $dossier->objectifs()->pluck('description')
            ->map(fn ($d) => Str::lower(trim($d)))
            ->all();

        $base = $dossier->wasRecentlyCreated ? Carbon::parse($dossier->date_ouverture) : now();
        $echeance = $base->copy()->addMonthsNoOverflow($moisEcheance)->toDateString();

        foreach ($this->lignes($pai['objectifs_de_soins'] ?? null) as $ligne) {
            $description = Str::limit($ligne, 252);
            if (in_array(Str::lower($description), $existants, true)) {
                continue;
            }
            $dossier->objectifs()->create([
                'description' => $description,
                'echeance' => $echeance,
                'issu_de_hissap' => true,
            ]);
            $existants[] = Str::lower($description);
        }
    }

    private function donnees(array $pai, bool $avecSante): array
    {
        $donnees = [
            'client_id' => $pai['client_id'],
            'publie_le' => $pai['publie_le'] ?? null,
            'beneficiaire' => $pai['beneficiaire'] ?? [],
            'tuteur' => $pai['tuteur'] ?? [],
            'responsable_secteur' => $pai['responsable_secteur']['nom'] ?? null,
            'consignes' => collect($pai['consignes'] ?? [])->map(fn ($v) => $this->texte($v))->filter()->all(),
            'sante' => null,
        ];

        if ($avecSante) {
            $donnees['sante'] = collect($pai['sante'] ?? [])->map(fn ($v) => $this->texte($v))->all();
        }

        return $donnees;
    }

    /** Les champs HisSAP viennent d'un éditeur riche : HTML -> texte, un paragraphe par ligne. */
    public function texte(?string $html): ?string
    {
        if ($html === null || trim($html) === '') {
            return null;
        }
        $texte = preg_replace('#<\s*(br\s*/?|/p|/li|/div|/h[1-6])\s*>#i', "\n", $html);
        $texte = html_entity_decode(strip_tags($texte), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $texte = preg_replace("/[ \t\x{00A0}]+/u", ' ', $texte);
        $texte = trim(preg_replace("/\n\s*\n+/", "\n", $texte));
        return $texte === '' ? null : $texte;
    }

    /** @return list<string> une ligne de texte = un objectif (puces et numéros retirés) */
    public function lignes(?string $html): array
    {
        $texte = $this->texte($html);
        if ($texte === null) {
            return [];
        }
        return collect(explode("\n", $texte))
            ->map(fn ($l) => trim(preg_replace('/^\s*([-*•·]|\d+[.)])\s*/u', '', $l)))
            ->filter(fn ($l) => $l !== '')
            ->values()
            ->all();
    }

    private function nomBeneficiaire(array $pai): string
    {
        $b = $pai['beneficiaire'] ?? [];
        $nom = trim(($b['prenom'] ?? '') . ' ' . ($b['nom'] ?? ''));
        return $nom !== '' ? $nom : 'Client HisSAP n° ' . $pai['client_id'];
    }

    private function titreLibre(string $titre, int $clientId): string
    {
        $titre = Str::limit($titre, 230, '');
        if (!PaiDossier::where('titre', $titre)->exists()) {
            return $titre;
        }
        return $titre . ' (HisSAP n° ' . $clientId . ')';
    }

    /** Le responsable de secteur HisSAP, retrouvé ici par son adresse e-mail. */
    private function responsableSecteurId(array $pai): ?int
    {
        $email = $pai['responsable_secteur']['email'] ?? null;
        if (!$email) {
            return null;
        }
        return Utilisateurs::whereRaw('LOWER(mail) = ?', [Str::lower(trim($email))])->value('id');
    }

    private function dateOuverture(array $pai): string
    {
        foreach (['publie_le', 'cree_le'] as $champ) {
            if (!empty($pai[$champ])) {
                try {
                    return Carbon::parse($pai[$champ])->toDateString();
                } catch (\Throwable) {
                }
            }
        }
        return now()->toDateString();
    }
}
