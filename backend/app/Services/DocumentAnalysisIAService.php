<?php

namespace App\Services;

use App\Models\DocumentArchive;
use App\Models\ServiceMetier;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Point d'entrée unique vers l'API Google Gemini pour l'assistance IA sur les
 * documents : lecture/OCR + suggestion de métadonnées à l'archivage, et
 * suggestion de service de transmission. Chaque méthode retourne null au
 * moindre problème (clé absente, timeout, erreur API, réponse inattendue) —
 * jamais d'exception qui remonte : l'appelant retombe simplement sur le
 * comportement manuel existant (voir DocumentController::analyserIa()/
 * suggererTransmission(), qui n'ont jamais rien de bloquant sur un null).
 *
 * Utilise la sortie structurée de Gemini (generationConfig.responseSchema)
 * plutôt que l'appel d'outil façon Claude — équivalent fonctionnel, plus
 * simple côté API Gemini pour ce cas d'usage (une seule "réponse", jamais un
 * vrai enchaînement d'outils).
 */
class DocumentAnalysisIAService
{
    private const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent';

    /**
     * Lit un fichier (PDF ou image, en base64) et propose titre/résumé/
     * référence/texte intégral. Utilisé à l'archivage (analyse synchrone d'un
     * fichier tout juste sélectionné) et pour le rattrapage des documents
     * existants (AnalyserDocumentIA, texte_extrait uniquement).
     */
    public function analyserFichier(string $contenuBase64, string $mimeType): ?array
    {
        $apiKey = config('services.gemini.api_key');
        if (!$apiKey) {
            return null;
        }

        $schema = [
            'type' => 'OBJECT',
            'properties' => [
                'titre_suggere' => ['type' => 'STRING', 'description' => 'Titre court et descriptif du document, en français.'],
                'resume_suggere' => ['type' => 'STRING', 'description' => 'Résumé en 1 à 2 phrases du contenu du document.'],
                'reference_suggeree' => ['type' => 'STRING', 'description' => "Numéro ou code de référence visible sur le document, chaîne vide si aucun."],
                'texte_extrait' => ['type' => 'STRING', 'description' => 'Le texte intégral lisible du document, transcrit tel quel.'],
            ],
            'required' => ['titre_suggere', 'resume_suggere', 'reference_suggeree', 'texte_extrait'],
        ];

        try {
            $reponse = Http::timeout(60)->post($this->url($apiKey), [
                'system_instruction' => [
                    'parts' => [[
                        'text' => "Tu assistes l'archivage de documents administratifs pour une association (Hetep Iaout Services). "
                            . "Analyse le document fourni et propose des métadonnées d'archivage précises, en français.",
                    ]],
                ],
                'contents' => [[
                    'role' => 'user',
                    'parts' => [
                        ['inline_data' => ['mime_type' => $mimeType, 'data' => $contenuBase64]],
                        ['text' => "Propose les métadonnées d'archivage pour ce document."],
                    ],
                ]],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'responseSchema' => $schema,
                ],
            ]);

            if (!$reponse->successful()) {
                Log::warning('DocumentAnalysisIAService::analyserFichier — appel API échoué', ['status' => $reponse->status()]);
                return null;
            }

            return $this->extraireReponseJson($reponse->json());
        } catch (\Throwable $e) {
            Log::warning('DocumentAnalysisIAService::analyserFichier — exception', ['message' => $e->getMessage()]);
            return null;
        }
    }

    /**
     * Suggère à quel(s) service(s) transmettre un document déjà archivé, à
     * partir de son contenu déjà en base (texte_extrait/resume/objet) — pas de
     * re-lecture du fichier. Ne choisit JAMAIS de personne précise, uniquement
     * parmi les codes de service réels fournis (voir DocView.jsx, qui résout
     * ensuite les vraies personnes via la logique existante).
     */
    public function suggererTransmission(DocumentArchive $document): ?array
    {
        $apiKey = config('services.gemini.api_key');
        if (!$apiKey) {
            return null;
        }

        $contenu = trim(($document->objet ?? '') . "\n" . ($document->resume ?? '') . "\n" . ($document->texte_extrait ?? ''));
        if ($contenu === '') {
            return null;
        }

        $servicesDisponibles = ServiceMetier::pluck('code_service')->all();
        if (empty($servicesDisponibles)) {
            return null;
        }

        $schema = [
            'type' => 'OBJECT',
            'properties' => [
                'service_codes' => [
                    'type' => 'ARRAY',
                    'items' => ['type' => 'STRING', 'enum' => $servicesDisponibles],
                    'description' => 'Codes des services concernés, uniquement parmi la liste fournie.',
                ],
                'justification' => ['type' => 'STRING', 'description' => 'Courte justification en français (une phrase).'],
            ],
            'required' => ['service_codes', 'justification'],
        ];

        try {
            $reponse = Http::timeout(30)->post($this->url($apiKey), [
                'system_instruction' => [
                    'parts' => [[
                        'text' => "Tu assistes le routage de documents administratifs pour une association (Hetep Iaout Services). "
                            . "Tu ne dois choisir que parmi les codes de service fournis, jamais en inventer.",
                    ]],
                ],
                'contents' => [[
                    'role' => 'user',
                    'parts' => [[
                        'text' => 'Services disponibles : ' . implode(', ', $servicesDisponibles)
                            . "\n\nContenu du document :\n" . mb_substr($contenu, 0, 8000),
                    ]],
                ]],
                'generationConfig' => [
                    'responseMimeType' => 'application/json',
                    'responseSchema' => $schema,
                ],
            ]);

            if (!$reponse->successful()) {
                Log::warning('DocumentAnalysisIAService::suggererTransmission — appel API échoué', ['status' => $reponse->status()]);
                return null;
            }

            $resultat = $this->extraireReponseJson($reponse->json());
            if (!$resultat) {
                return null;
            }

            // Filet de sécurité en plus de la contrainte "enum" du schéma : on ne
            // fait jamais confiance aveuglément à une sortie IA, on retire ici tout
            // code qui ne serait pas réellement dans la liste fournie.
            $resultat['service_codes'] = array_values(array_intersect($resultat['service_codes'] ?? [], $servicesDisponibles));

            return $resultat;
        } catch (\Throwable $e) {
            Log::warning('DocumentAnalysisIAService::suggererTransmission — exception', ['message' => $e->getMessage()]);
            return null;
        }
    }

    private function url(string $apiKey): string
    {
        return sprintf(self::API_URL, config('services.gemini.model')) . '?key=' . $apiKey;
    }

    /**
     * Avec responseMimeType=application/json, Gemini renvoie le JSON demandé
     * comme TEXTE dans la première partie de la réponse — il faut donc le
     * décoder nous-mêmes, contrairement à l'appel d'outil de Claude qui
     * rendait directement une structure.
     */
    private function extraireReponseJson(array $reponseJson): ?array
    {
        $texte = $reponseJson['candidates'][0]['content']['parts'][0]['text'] ?? null;
        if (!$texte) {
            return null;
        }

        $decode = json_decode($texte, true);
        return is_array($decode) ? $decode : null;
    }
}
