<?php

namespace App\Jobs;

use App\Models\DocumentArchive;
use App\Services\DocumentAnalysisIAService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

/**
 * Rattrapage IA d'un document existant qui n'a jamais eu de texte extrait
 * (uploadé avant cette fonctionnalité, ou déposé hors du flux de scan
 * caméra) — voir la commande documents:analyser-ia-retroactif qui dispatche
 * ce job. Ne touche JAMAIS titre_document/resume, déjà saisis par un humain :
 * seul texte_extrait est mis à jour, uniquement pour la recherche.
 */
class AnalyserDocumentIA implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;

    public function __construct(public DocumentArchive $document)
    {
    }

    public function handle(DocumentAnalysisIAService $service): void
    {
        try {
            if (!$this->document->chemin_stockage_serveur || !$this->document->format_mime) {
                return;
            }

            $disk = Storage::disk(config('filesystems.document_disk'));
            if (!$disk->exists($this->document->chemin_stockage_serveur)) {
                return;
            }

            $contenuBase64 = base64_encode($disk->get($this->document->chemin_stockage_serveur));
            $resultat = $service->analyserFichier($contenuBase64, $this->document->format_mime);

            if ($resultat && !empty($resultat['texte_extrait'])) {
                $this->document->update(['texte_extrait' => $resultat['texte_extrait']]);
            }
        } catch (\Throwable $th) {
            report($th);
        }
    }
}
