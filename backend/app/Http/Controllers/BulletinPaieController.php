<?php

namespace App\Http\Controllers;

use App\Enums\StatutDocument;
use App\Events\DocumentStatutMisAJour;
use App\Jobs\EnvoyerBulletinPaie;
use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\EnvoiBulletinPaie;
use App\Models\HistoriqueStatut;
use App\Models\Personnels;
use App\Models\TypeDocument;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Dépôt groupé des bulletins de paie, et leur envoi par mail — réservé aux
 * administrateurs (voir AdminSeulementMiddleware, routes/api.php), demande
 * explicite 2026-11-18.
 *
 * Classe à part de DocumentController (déjà très volumineux) plutôt qu'une
 * méthode de plus dessus, même si le dépôt réutilise ses mêmes primitives de
 * stockage (nom de fichier opaque, dossier categorie_X/type_Y) : ce
 * contrôleur a son propre périmètre fonctionnel (un salarié + un mois),
 * distinct de l'archivage générique.
 *
 * Étape volontairement temporaire (le choix du salarié a été explicite,
 * 2026-11-18) : le mail est une couche de distribution par-dessus le
 * classement "Bulletin de paie" > salarié déjà en place depuis la réponse à
 * une demande individuelle (voir DocumentController::decisionPaie). Un
 * espace personnel en libre-service, plus tard, lira exactement les mêmes
 * documents sans rien reconstruire ici.
 */
class BulletinPaieController extends Controller
{
    /** Le type racine "Bulletin de paie", créé par TypeDocumentSeeder — jamais absent en pratique. */
    private function typeBulletin(): ?TypeDocument
    {
        $categorie = CategorieDocument::where('code', 'ComptpaieFinance')->first();

        return $categorie
            ? TypeDocument::where('categorie_id', $categorie->id)->whereNull('parent_id')->where('libelle', 'Bulletin de paie')->first()
            : null;
    }

    // ------------------------------------------------------------------ Dépôt

    /**
     * Dépose plusieurs bulletins d'un coup — un fichier par salarié et par
     * mois (demande explicite : pas d'export groupé à découper, un fichier
     * par bulletin). `assignations` est un tableau JSON
     * [{ index, personnel_id, mois }], index pointant vers `fichiers.<index>`.
     *
     * Chaque bulletin est rangé directement sous "Bulletin de paie" >
     * [salarié] (sous-dossier créé au besoin, même mécanisme que
     * decisionPaie), marqué déjà traité, SANS notification — confirmé
     * 2026-11-17 : un dépôt groupé prévient dix fois en quelques minutes
     * sinon, ce que personne ne veut.
     */
    public function store(Request $request)
    {
        $valide = $request->validate([
            'fichiers' => 'required|array|min:1',
            'fichiers.*' => 'required|file|mimes:pdf|max:32048',
            'assignations' => 'required|string',
        ]);

        $assignations = json_decode($valide['assignations'], true);
        if (!is_array($assignations)) {
            return response()->json(['error' => "Liste d'assignations illisible."], 422);
        }

        $typeBulletin = $this->typeBulletin();
        if (!$typeBulletin) {
            return response()->json(['error' => 'Le dossier "Bulletin de paie" est introuvable — contactez un administrateur.'], 500);
        }
        if ($typeBulletin->categorieDocument?->estVerrouille()) {
            return response()->json(['error' => 'Le dossier "Bulletin de paie" est verrouillé — déverrouillez-le avant de déposer des bulletins.'], 423);
        }

        $fichiers = $request->file('fichiers') ?? [];
        $resultats = [];
        $personnelsVus = [];

        foreach ($assignations as $ligne) {
            $index = $ligne['index'] ?? null;
            $personnelId = $ligne['personnel_id'] ?? null;
            $mois = $ligne['mois'] ?? null;
            $fichier = is_int($index) || ctype_digit((string) $index) ? ($fichiers[(int) $index] ?? null) : null;

            if (!$fichier || !$personnelId || !$mois) {
                $resultats[] = ['index' => $index, 'ok' => false, 'erreur' => 'Ligne incomplète (fichier, salarié ou mois manquant).'];
                continue;
            }

            $personnel = $personnelsVus[$personnelId] ??= Personnels::find($personnelId);
            if (!$personnel) {
                $resultats[] = ['index' => $index, 'ok' => false, 'erreur' => 'Salarié introuvable.'];
                continue;
            }

            try {
                $moisDate = Carbon::parse($mois)->startOfMonth();
            } catch (\Throwable) {
                $resultats[] = ['index' => $index, 'ok' => false, 'erreur' => 'Mois illisible.'];
                continue;
            }

            $document = $this->deposerUnBulletin($fichier, $typeBulletin, $personnel, $moisDate);
            $resultats[] = ['index' => $index, 'ok' => true, 'document_id' => $document->id];
        }

        $reussis = collect($resultats)->where('ok', true)->count();

        return response()->json([
            'resultats' => $resultats,
            'deposes' => $reussis,
            'total' => count($resultats),
        ], $reussis > 0 ? 201 : 422);
    }

    private function deposerUnBulletin($fichier, TypeDocument $typeBulletin, Personnels $personnel, Carbon $moisDate): DocumentArchive
    {
        $nomPersonnel = trim("{$personnel->nom} {$personnel->prenom}");

        return DB::transaction(function () use ($fichier, $typeBulletin, $personnel, $moisDate, $nomPersonnel) {
            // firstOrCreate, pas find : le sous-dossier du salarié peut déjà
            // exister (créé par une réponse à une demande individuelle, voir
            // DocumentController::decisionPaie) — jamais de doublon.
            $dossierPersonne = TypeDocument::firstOrCreate([
                'categorie_id' => $typeBulletin->categorie_id,
                'parent_id' => $typeBulletin->id,
                'libelle' => $nomPersonnel,
            ]);

            $contenu = file_get_contents($fichier->getRealPath());
            $checksum = hash('sha256', $contenu);
            $nomFichier = Str::uuid() . '.pdf';
            $dossierDisque = "categorie_{$typeBulletin->categorie_id}/type_{$dossierPersonne->id}";
            $chemin = $dossierDisque . '/' . $nomFichier;

            Storage::disk(config('filesystems.document_disk'))->makeDirectory($dossierDisque);
            Storage::disk(config('filesystems.document_disk'))->put($chemin, $contenu);

            $libelleMois = ucfirst($moisDate->locale('fr')->isoFormat('MMMM YYYY'));

            $document = DocumentArchive::create([
                'utilisateur_id' => auth('api')->id(),
                'personnel_concerne_id' => $personnel->id,
                'categorie_id' => $typeBulletin->categorie_id,
                'type_document_id' => $dossierPersonne->id,
                'titre_document' => "Bulletin de paie — {$libelleMois}",
                'auteur' => $nomPersonnel,
                'resume' => '',
                'code_reference' => 'PAIE-' . $moisDate->format('Ym') . '-' . Str::upper(Str::substr(Str::slug($nomPersonnel), 0, 12)),
                'status_doc' => StatutDocument::VALIDE_ET_TRAITE->value,
                'nom_fichier_original' => $fichier->getClientOriginalName(),
                'chemin_stockage_serveur' => $chemin,
                'format_mime' => 'application/pdf',
                'taille' => $fichier->getSize(),
                'checksum_sha256' => $checksum,
                'file_create_date' => now()->toDateString(),
                'mois_concerne' => $moisDate->toDateString(),
                'date_archivage' => now(),
                'duree_conservation_annees' => 50,
            ]);

            HistoriqueStatut::create([
                'document_archive_id' => $document->id,
                'utilisateur_id' => auth('api')->id(),
                'ancien_statut' => null,
                'nouveau_statut' => StatutDocument::VALIDE_ET_TRAITE->value,
                'date_changement' => now(),
                'motif_changement' => 'Déposé en masse (bulletins de paie) — déjà traité',
            ]);

            // Aucun appel à notifierValidateurs() : confirmé 2026-11-17, pas de
            // notification au dépôt groupé.
            broadcast(new DocumentStatutMisAJour($document));

            return $document;
        });
    }

    // ---------------------------------------------------------------- Envoi

    /**
     * État d'un mois pour chaque salarié : bulletin déposé ou non, mail
     * disponible ou non, déjà envoyé ou non. Partagé par apercuEnvoi()
     * (un mois, tout le détail) et suivi() (plusieurs mois, juste l'essentiel) —
     * une seule requête "bulletin déposé ?" / "déjà envoyé ?" à tenir juste.
     */
    private function etatMois(Carbon $moisDate, ?TypeDocument $typeBulletin): \Illuminate\Support\Collection
    {
        $personnels = Personnels::with(['bureau', 'user:id,mail'])->orderBy('nom')->orderBy('prenom')->get();
        // orderBy('id') avant keyBy() : en cas de plusieurs tentatives pour le
        // même salarié (un échec puis un nouvel envoi), keyBy() garde le
        // DERNIER élément rencontré pour une clé — il faut donc garantir que
        // "dernier rencontré" = "le plus récent", pas l'ordre par défaut
        // (non garanti) du SGBD.
        $envoisDuMois = EnvoiBulletinPaie::whereDate('mois', $moisDate->toDateString())->orderBy('id')->get()->keyBy('personnel_id');

        return $personnels->map(function (Personnels $p) use ($typeBulletin, $moisDate, $envoisDuMois) {
            $nomPersonnel = trim("{$p->nom} {$p->prenom}");
            $mail = $p->user?->mail;

            $document = $typeBulletin
                ? DocumentArchive::where('categorie_id', $typeBulletin->categorie_id)
                    ->whereHas('typeDocument', fn ($q) => $q->where('parent_id', $typeBulletin->id)->where('libelle', $nomPersonnel))
                    ->whereDate('mois_concerne', $moisDate->toDateString())
                    ->latest('id')
                    ->first()
                : null;

            $envoi = $envoisDuMois->get($p->id);
            $dejaEnvoye = $envoi && $envoi->statut === 'envoye';
            $peutEnvoyer = (bool) ($document && $mail && !$dejaEnvoye);
            $raisonExclusion = match (true) {
                $dejaEnvoye => 'deja_envoye',
                $peutEnvoyer => null,
                !$document => 'pas_de_bulletin',
                !$mail => 'pas_de_mail',
                default => 'inconnue',
            };

            return [
                'personnel_id' => $p->id,
                'nom' => $nomPersonnel,
                'bureau' => $p->bureau?->name ?: null,
                'mail' => $mail,
                'bulletin_trouve' => (bool) $document,
                'document_id' => $document?->id,
                'nom_fichier_original' => $document?->nom_fichier_original,
                'sera_envoye' => $peutEnvoyer,
                'deja_envoye' => $dejaEnvoye,
                'envoye_le' => $dejaEnvoye ? $envoi->envoye_le : null,
                'raison_exclusion' => $raisonExclusion,
                'dernier_statut' => $envoi?->statut,
                'derniere_erreur' => $envoi?->statut === 'echec' ? $envoi->erreur : null,
            ];
        });
    }

    /**
     * Pour un mois donné, qui recevra le mail et qui en est exclu, et
     * pourquoi — l'écran de confirmation doit tout montrer avant le moindre
     * envoi, un mail parti ne se rattrape pas.
     */
    public function apercuEnvoi(Request $request)
    {
        $valide = $request->validate(['mois' => 'required|date_format:Y-m']);
        $moisDate = Carbon::parse($valide['mois'] . '-01');

        $lignes = $this->etatMois($moisDate, $this->typeBulletin());

        return response()->json([
            'mois' => $moisDate->toDateString(),
            'lignes' => $lignes->values(),
            'total' => $lignes->count(),
            'recevront' => $lignes->where('sera_envoye', true)->count(),
            'sans_bulletin' => $lignes->where('raison_exclusion', 'pas_de_bulletin')->count(),
            'sans_mail' => $lignes->where('raison_exclusion', 'pas_de_mail')->count(),
            'deja_envoyes' => $lignes->where('deja_envoye', true)->count(),
        ], 200);
    }

    /**
     * Suivi compact sur plusieurs mois à la fois (grille de l'onglet "Suivi
     * annuel") — seulement déposé/envoyé par salarié, pas le détail mail/
     * raison déjà donné par apercuEnvoi() pour le mois courant.
     */
    public function suivi(Request $request)
    {
        $valide = $request->validate([
            'mois' => 'required|array|min:1|max:12',
            'mois.*' => 'date_format:Y-m',
        ]);

        $typeBulletin = $this->typeBulletin();

        $parMois = collect($valide['mois'])->map(function (string $m) use ($typeBulletin) {
            $moisDate = Carbon::parse($m . '-01');
            $lignes = $this->etatMois($moisDate, $typeBulletin)->map(fn ($l) => [
                'personnel_id' => $l['personnel_id'],
                'nom' => $l['nom'],
                'bulletin_trouve' => $l['bulletin_trouve'],
                'deja_envoye' => $l['deja_envoye'],
            ]);

            return ['mois' => $m, 'lignes' => $lignes->values()];
        });

        return response()->json($parMois->values(), 200);
    }

    /**
     * Déclenche l'envoi — admin-only (voir la route). Crée une ligne de
     * suivi par destinataire puis dispatche un job par ligne : un échec
     * individuel (adresse invalide, boîte pleine) n'empêche jamais les
     * autres de partir. `personnel_ids` restreint l'envoi à une sélection
     * (ex: renvoyer seulement à ceux qui avaient échoué) — vide ou absent :
     * tout le monde d'après l'aperçu.
     */
    public function envoyer(Request $request)
    {
        $valide = $request->validate([
            'mois' => 'required|date_format:Y-m',
            'personnel_ids' => 'nullable|array',
            'personnel_ids.*' => 'integer',
        ]);
        $moisDate = Carbon::parse($valide['mois'] . '-01');

        $apercu = $this->apercuEnvoi(new Request(['mois' => $valide['mois']]))->getData(true);
        $aEnvoyer = collect($apercu['lignes'])->where('sera_envoye', true);

        if (!empty($valide['personnel_ids'])) {
            $aEnvoyer = $aEnvoyer->whereIn('personnel_id', $valide['personnel_ids']);
        }

        if ($aEnvoyer->isEmpty()) {
            return response()->json(['error' => 'Personne à qui envoyer pour ce mois.'], 422);
        }

        $envoiIds = [];
        foreach ($aEnvoyer as $ligne) {
            $envoi = EnvoiBulletinPaie::create([
                'mois' => $moisDate->toDateString(),
                'personnel_id' => $ligne['personnel_id'],
                'document_archive_id' => $ligne['document_id'],
                'mail_utilise' => $ligne['mail'],
                'statut' => 'en_attente',
                'cree_par_id' => auth('api')->id(),
            ]);
            $envoiIds[] = $envoi->id;
        }

        foreach ($envoiIds as $id) {
            EnvoyerBulletinPaie::dispatch($id);
        }

        return response()->json(['lances' => count($envoiIds)], 202);
    }

    /** Suivi des envois d'un mois — qui a reçu, qui a échoué et pourquoi, qui attend encore. */
    public function envois(Request $request)
    {
        $valide = $request->validate(['mois' => 'required|date_format:Y-m']);
        $moisDate = Carbon::parse($valide['mois'] . '-01');

        $envois = EnvoiBulletinPaie::with('personnel:id,nom,prenom')
            ->whereDate('mois', $moisDate->toDateString())
            ->latest('id')
            ->get();

        return response()->json($envois, 200);
    }
}
