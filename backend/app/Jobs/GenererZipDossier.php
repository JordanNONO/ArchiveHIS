<?php

namespace App\Jobs;

use App\Models\DocumentArchive;
use App\Models\FolderExport;
use App\Notifications\FolderExportFailedNotification;
use App\Notifications\FolderExportReadyNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

/**
 * Construit le ZIP d'un dossier en tâche de fond : peut prendre du temps sans
 * jamais bloquer le serveur ni les autres utilisateurs, contrairement à une
 * génération synchrone dans la requête HTTP.
 */
class GenererZipDossier implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public FolderExport $export)
    {
    }

    public function handle(): void
    {
        $this->export->update(['statut' => 'en_cours']);

        try {
            // Au niveau catégorie, on garde le classement par sous-dossier à l'intérieur
            // du ZIP (un dossier par type) au lieu de mélanger tous les fichiers en vrac —
            // au niveau sous-dossier, tout est déjà d'un seul niveau, pas besoin.
            $requete = $this->export->categorie_id
                ? DocumentArchive::where('categorie_id', $this->export->categorie_id)->with('typeDocument')
                : DocumentArchive::where('type_document_id', $this->export->type_document_id);

            if ($this->export->nom_personne_concernee) {
                $requete->where('nom_personne_concernee', $this->export->nom_personne_concernee);
            }

            $documents = $requete->get();

            $disk = Storage::disk(config('filesystems.document_disk'));
            Storage::disk('local')->makeDirectory('exports');
            $cheminRelatif = 'exports/export_' . $this->export->id . '_' . uniqid() . '.zip';
            $cheminAbsolu = Storage::disk('local')->path($cheminRelatif);

            $zip = new ZipArchive();
            $zip->open($cheminAbsolu, ZipArchive::CREATE);

            $nomsUtilisesParDossier = [];
            foreach ($documents as $document) {
                if (!$document->chemin_stockage_serveur || !$disk->exists($document->chemin_stockage_serveur)) {
                    continue;
                }

                $sousDossier = ($this->export->categorie_id && $document->typeDocument)
                    ? $this->nettoyerNomDossier($document->typeDocument->libelle) . '/'
                    : '';

                $extension = pathinfo($document->chemin_stockage_serveur, PATHINFO_EXTENSION);
                $nom = $document->nom_fichier_original ?: ($document->titre_document . '.' . $extension);

                $nomsUtilisesParDossier[$sousDossier] ??= [];
                if (isset($nomsUtilisesParDossier[$sousDossier][$nom])) {
                    $nomsUtilisesParDossier[$sousDossier][$nom]++;
                    $nom = pathinfo($nom, PATHINFO_FILENAME) . ' (' . $nomsUtilisesParDossier[$sousDossier][$nom] . ').' . $extension;
                } else {
                    $nomsUtilisesParDossier[$sousDossier][$nom] = 0;
                }

                $zip->addFromString($sousDossier . $nom, $disk->get($document->chemin_stockage_serveur));
            }
            $zip->close();

            $this->export->update([
                'statut' => 'pret',
                'chemin_fichier' => $cheminRelatif,
            ]);

            $this->export->utilisateur->notify(new FolderExportReadyNotification($this->export));
        } catch (\Throwable $th) {
            report($th);
            // Le détail technique reste dans les logs serveur (report() ci-dessus) —
            // la colonne erreur est renvoyée telle quelle par GET /telechargements,
            // donc jamais le message brut d'une exception système.
            $this->export->update(['statut' => 'echoue', 'erreur' => "La génération de l'archive a échoué."]);
            $this->export->utilisateur->notify(new FolderExportFailedNotification($this->export));
        }
    }

    /**
     * Nom de sous-dossier sûr à l'intérieur du ZIP (pas de caractères spéciaux
     * qui posent problème selon l'outil d'extraction utilisé).
     */
    private function nettoyerNomDossier(string $nom): string
    {
        return preg_replace('/[^\p{L}\p{N}_\- ]/u', '', $nom) ?: 'Sans nom';
    }
}
