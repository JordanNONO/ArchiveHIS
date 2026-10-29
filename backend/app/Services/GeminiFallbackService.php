<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Relais gratuit (API Gemini de Google) utilisé quand Claude est indisponible
 * (clé absente, panne, quota épuisé). Reprend le même contrat de retour que
 * DocumentAnalysisIAService::analyserFichier() (titre_suggere/resume_suggere/
 * objet_suggere/reference_suggeree/texte_extrait) pour servir de relais
 * transparent dans DocumentController::analyserIa()/AnalyserDocumentIA — à la
 * différence d'OcrFallbackService (dernier recours), Gemini sait aussi
 * proposer titre/résumé/référence, pas seulement extraire le texte brut.
 */
class GeminiFallbackService
{
    private const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent';

    public function analyserFichier(string $contenuBase64, string $mimeType): ?array
    {
        $apiKey = config('services.gemini.api_key');
        if (!$apiKey) {
            return null;
        }

        $url = sprintf(self::API_URL, config('services.gemini.model'));

        try {
            $reponse = Http::timeout(60)->post("{$url}?key={$apiKey}", [
                'systemInstruction' => [
                    'parts' => [[
                        'text' => "Tu assistes l'archivage de documents administratifs pour une association "
                            . "(Hetep Iaout Services). Analyse le document fourni et propose des métadonnées "
                            . "d'archivage précises, en français.",
                    ]],
                ],
                'contents' => [[
                    'parts' => [
                        ['inline_data' => ['mime_type' => $mimeType, 'data' => $contenuBase64]],
                        ['text' => "Propose les métadonnées d'archivage pour ce document."],
                    ],
                ]],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'responseSchema' => [
                        'type' => 'OBJECT',
                        'properties' => [
                            'titre_suggere' => ['type' => 'STRING', 'description' => 'Titre court et descriptif du document, en français.'],
                            'resume_suggere' => ['type' => 'STRING', 'description' => 'Résumé en 1 à 2 phrases du contenu du document.'],
                            'objet_suggere' => ['type' => 'STRING', 'description' => "Objet précis du document en quelques mots, chaîne vide si peu clair."],
                            'reference_suggeree' => ['type' => 'STRING', 'description' => "Numéro ou code de référence visible sur le document, chaîne vide si aucun."],
                            'texte_extrait' => ['type' => 'STRING', 'description' => 'Le texte intégral lisible du document, transcrit tel quel.'],
                        ],
                        'required' => ['titre_suggere', 'resume_suggere', 'objet_suggere', 'reference_suggeree', 'texte_extrait'],
                    ],
                ],
            ]);

            if (!$reponse->successful()) {
                Log::warning('GeminiFallbackService::analyserFichier — appel API échoué', ['status' => $reponse->status()]);
                return null;
            }

            $texteJson = $reponse->json('candidates.0.content.parts.0.text');
            if (!$texteJson) {
                return null;
            }

            $resultat = json_decode($texteJson, true);
            return is_array($resultat) ? $resultat : null;
        } catch (\Throwable $e) {
            Log::warning('GeminiFallbackService::analyserFichier — exception', ['message' => $e->getMessage()]);
            return null;
        }
    }
}
