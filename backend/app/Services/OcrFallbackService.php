<?php

namespace App\Services;

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

/**
 * Relais local (Tesseract OCR) quand DocumentAnalysisIAService (Claude) ne
 * peut pas répondre — clé API absente, panne/quota de l'API, timeout. Les
 * deux appelants (AnalyserDocumentIA::handle() et DocumentController::
 * analyserIa()) tentent TOUJOURS Claude en premier à chaque appel ; cette
 * classe n'est utilisée qu'en repli pour ce seul appel, jamais mémorisée —
 * dès que Claude répond à nouveau, il reprend automatiquement le relais au
 * prochain document, sans bascule à gérer manuellement.
 *
 * Ne fournit que le texte brut (pour l'indexation texte_recherche) : contrairement
 * à Claude, Tesseract ne sait pas suggérer de titre/résumé/référence pertinents.
 *
 * Nécessite les paquets système tesseract-ocr, tesseract-ocr-fra et
 * poppler-utils (pour pdftoppm, qui transforme chaque page PDF en image avant
 * OCR — Tesseract ne lit pas le PDF directement). Si absents, renvoie null
 * silencieusement : jamais bloquant pour l'archivage.
 */
class OcrFallbackService
{
    public function extraireTexte(string $contenuBinaire, string $mimeType): ?string
    {
        $dossierTemp = storage_path('app/ocr_tmp/' . Str::uuid());

        try {
            // outilsDisponibles() exécute aussi un sous-processus (which) — s'il
            // plante (proc_open/exec désactivé par l'hébergeur, par exemple),
            // ça doit être absorbé ici comme le reste, jamais remonter jusqu'à
            // l'appelant (voir DocumentController::analyserIa(), qui n'a pas
            // son propre try/catch autour de cet appel).
            if (!$this->outilsDisponibles()) {
                return null;
            }

            File::ensureDirectoryExists($dossierTemp);

            $images = $mimeType === 'application/pdf'
                ? $this->rasteriserPdf($contenuBinaire, $dossierTemp)
                : $this->ecrireImage($contenuBinaire, $mimeType, $dossierTemp);

            $texte = '';
            foreach ($images as $image) {
                $texte .= $this->ocrImage($image) . "\n";
            }

            $texte = trim($texte);
            return $texte !== '' ? $texte : null;
        } catch (\Throwable $e) {
            Log::warning('OcrFallbackService::extraireTexte — exception', ['message' => $e->getMessage()]);
            return null;
        } finally {
            File::deleteDirectory($dossierTemp);
        }
    }

    private function rasteriserPdf(string $contenuPdf, string $dossierTemp): array
    {
        File::put("{$dossierTemp}/source.pdf", $contenuPdf);

        $process = new Process(['pdftoppm', '-r', '200', '-png', "{$dossierTemp}/source.pdf", "{$dossierTemp}/page"]);
        $process->setTimeout(90);
        $process->run();

        if (!$process->isSuccessful()) {
            Log::warning('OcrFallbackService::rasteriserPdf — pdftoppm a échoué', ['erreur' => $process->getErrorOutput()]);
            return [];
        }

        $images = glob("{$dossierTemp}/page-*.png") ?: [];
        sort($images);

        return $images;
    }

    private function ecrireImage(string $contenuImage, string $mimeType, string $dossierTemp): array
    {
        $extension = match ($mimeType) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };

        $chemin = "{$dossierTemp}/source.{$extension}";
        File::put($chemin, $contenuImage);

        return [$chemin];
    }

    private function ocrImage(string $cheminImage): string
    {
        $process = new Process(['tesseract', $cheminImage, 'stdout', '-l', 'fra']);
        $process->setTimeout(60);
        $process->run();

        if (!$process->isSuccessful()) {
            Log::warning('OcrFallbackService::ocrImage — tesseract a échoué', ['erreur' => $process->getErrorOutput()]);
            return '';
        }

        return $process->getOutput();
    }

    private function outilsDisponibles(): bool
    {
        static $disponible = null;

        if ($disponible === null) {
            $tesseract = new Process(['which', 'tesseract']);
            $tesseract->run();
            $pdftoppm = new Process(['which', 'pdftoppm']);
            $pdftoppm->run();
            $disponible = $tesseract->isSuccessful() && $pdftoppm->isSuccessful();
        }

        return $disponible;
    }
}
