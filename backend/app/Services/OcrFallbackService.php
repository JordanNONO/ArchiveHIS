<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Relais (API OCR.space) quand DocumentAnalysisIAService (Claude) ne peut pas
 * répondre — clé API absente, panne/quota de l'API, timeout. Les deux
 * appelants (AnalyserDocumentIA::handle() et DocumentController::analyserIa())
 * tentent TOUJOURS Claude en premier à chaque appel ; cette classe n'est
 * utilisée qu'en repli pour ce seul appel, jamais mémorisée — dès que Claude
 * répond à nouveau, il reprend automatiquement le relais au prochain
 * document, sans bascule à gérer manuellement.
 *
 * Ne fournit que le texte brut (pour l'indexation texte_recherche) : contrairement
 * à Claude, OCR.space ne sait pas suggérer de titre/résumé/référence pertinents.
 *
 * Choisi à la place d'un binaire Tesseract local : un appel HTTP (comme pour
 * Claude) évite toute dépendance à l'environnement du serveur (PATH, droits
 * d'exécution, cache OPcache...) qui a posé problème en pratique. Nécessite
 * OCRSPACE_API_KEY dans .env (clé gratuite sur ocr.space, ~25 000 requêtes/mois).
 * Limite connue du plan gratuit : fichiers de 1 Mo maximum.
 */
class OcrFallbackService
{
    private const API_URL = 'https://api.ocr.space/parse/image';

    public function extraireTexte(string $contenuBinaire, string $mimeType): ?string
    {
        $apiKey = config('services.ocrspace.api_key');
        if (!$apiKey) {
            return null;
        }

        $extension = match ($mimeType) {
            'application/pdf' => 'pdf',
            'image/png' => 'png',
            'image/jpeg', 'image/jpg' => 'jpg',
            'image/webp' => 'webp',
            default => null,
        };

        if (!$extension) {
            return null;
        }

        try {
            $reponse = Http::timeout(60)
                ->attach('file', $contenuBinaire, "document.{$extension}")
                ->post(self::API_URL, [
                    'apikey' => $apiKey,
                    'language' => 'fre',
                    'OCREngine' => 2,
                    'isOverlayRequired' => 'false',
                    'scale' => 'true',
                ]);

            if (!$reponse->successful()) {
                Log::warning('OcrFallbackService::extraireTexte — appel OCR.space échoué', ['status' => $reponse->status()]);
                return null;
            }

            $donnees = $reponse->json();

            if (!empty($donnees['IsErroredOnProcessing'])) {
                Log::warning('OcrFallbackService::extraireTexte — erreur de traitement OCR.space', ['erreur' => $donnees['ErrorMessage'] ?? null]);
                return null;
            }

            $texte = trim(implode("\n", array_column($donnees['ParsedResults'] ?? [], 'ParsedText')));

            return $texte !== '' ? $texte : null;
        } catch (\Throwable $e) {
            Log::warning('OcrFallbackService::extraireTexte — exception', ['message' => $e->getMessage()]);
            return null;
        }
    }
}
