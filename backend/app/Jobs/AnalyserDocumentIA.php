<?php

namespace App\Jobs;

use App\Models\DocumentArchive;
use App\Services\DocumentAnalysisIAService;
use App\Services\OnlyOfficeConversionService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * Rattrapage IA d'un document existant qui n'a jamais eu de texte extrait
 * (uploadé avant cette fonctionnalité, ou déposé hors du flux de scan
 * caméra) — voir la commande documents:analyser-ia-retroactif qui dispatche
 * ce job, et DocumentController::lancerAnalyseIaSiNecessaire() qui le fait
 * automatiquement à chaque dépôt/remplacement. Ne touche JAMAIS
 * titre_document/resume, déjà saisis par un humain : seul texte_extrait est
 * mis à jour, uniquement pour la recherche.
 *
 * Claude ne sait lire que du PDF/image directement — un fichier bureautique
 * (Word/Excel/PowerPoint...) passe d'abord par OnlyOfficeConversionService
 * pour être converti en PDF, réutilisant le serveur OnlyOffice déjà déployé
 * pour l'édition en ligne. Sans cette étape, l'analyse IA à l'archivage ne
 * fonctionnait que pour les PDF/images, pas pour le reste des formats
 * bureautiques pourtant acceptés à l'archivage (voir ArchiverDocumentModal).
 */
class AnalyserDocumentIA implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public DocumentArchive $document)
    {
    }

    public function handle(DocumentAnalysisIAService $service, OnlyOfficeConversionService $conversion): void
    {
        try {
            if (!$this->document->chemin_stockage_serveur || !$this->document->format_mime) {
                return;
            }

            $disk = Storage::disk(config('filesystems.document_disk'));
            if (!$disk->exists($this->document->chemin_stockage_serveur)) {
                return;
            }

            $mime = $this->document->format_mime;
            $extension = strtolower(pathinfo($this->document->chemin_stockage_serveur, PATHINFO_EXTENSION));

            if ($mime === 'application/pdf' || str_starts_with($mime, 'image/')) {
                $contenuBase64 = base64_encode($disk->get($this->document->chemin_stockage_serveur));
                $mimeAAnalyser = $mime;
            } elseif (OnlyOfficeConversionService::estConvertible($extension)) {
                $urlSignee = URL::temporarySignedRoute('documents.show', now()->addMinutes(15), ['doc_id' => $this->document->id]);
                // La clé doit changer si le fichier change — reprend le même
                // ingrédient que document.key dans ouvrirEditionWord().
                $cle = substr(hash('sha256', "{$this->document->id}-{$this->document->checksum_sha256}"), 0, 40);
                $pdf = $conversion->convertirEnPdf($urlSignee, $extension, $cle);
                if (!$pdf) {
                    return;
                }
                $contenuBase64 = base64_encode($pdf);
                $mimeAAnalyser = 'application/pdf';
            } else {
                // Format non convertible (ex: .zip) — rien à en tirer.
                return;
            }

            $resultat = $service->analyserFichier($contenuBase64, $mimeAAnalyser);

            if ($resultat && !empty($resultat['texte_extrait'])) {
                $this->document->update(['texte_extrait' => $resultat['texte_extrait']]);
            }
        } catch (\Throwable $th) {
            report($th);
        }
    }
}
