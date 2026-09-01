<?php

namespace App\Services;

use App\Models\DocumentArchive;
use App\Models\ServiceMetier;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Point d'entrée unique vers l'API Anthropic (Claude) pour l'assistance IA sur
 * les documents : lecture/OCR + suggestion de métadonnées à l'archivage, et
 * suggestion de service de transmission. Chaque méthode retourne null au
 * moindre problème (clé absente, timeout, erreur API, réponse inattendue) —
 * jamais d'exception qui remonte : l'appelant retombe simplement sur le
 * comportement manuel existant (voir DocumentController::analyserIa()/
 * suggererTransmission(), qui n'ont jamais rien de bloquant sur un null).
 */
class DocumentAnalysisIAService
{
    private const API_URL = 'https://api.anthropic.com/v1/messages';
    private const API_VERSION = '2023-06-01';

    /**
     * Lit un fichier (PDF ou image, en base64) et propose titre/résumé/
     * référence/texte intégral. Utilisé à l'archivage (analyse synchrone d'un
     * fichier tout juste sélectionné) et pour le rattrapage des documents
     * existants (AnalyserDocumentIA, texte_extrait uniquement).
     */
    public function analyserFichier(string $contenuBase64, string $mimeType): ?array
    {
        $apiKey = config('services.anthropic.api_key');
        if (!$apiKey) {
            return null;
        }

        $typeBloc = $mimeType === 'application/pdf' ? 'document' : 'image';

        $outil = [
            'name' => 'proposer_metadonnees_document',
            'description' => "Propose les métadonnées d'archivage pour ce document.",
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'titre_suggere' => ['type' => 'string', 'description' => 'Titre court et descriptif du document, en français.'],
                    'resume_suggere' => ['type' => 'string', 'description' => 'Résumé en 1 à 2 phrases du contenu du document.'],
                    'reference_suggeree' => ['type' => 'string', 'description' => "Numéro ou code de référence visible sur le document, chaîne vide si aucun."],
                    'texte_extrait' => ['type' => 'string', 'description' => 'Le texte intégral lisible du document, transcrit tel quel.'],
                ],
                'required' => ['titre_suggere', 'resume_suggere', 'reference_suggeree', 'texte_extrait'],
            ],
        ];

        try {
            $reponse = Http::withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => self::API_VERSION,
            ])->timeout(60)->post(self::API_URL, [
                'model' => config('services.anthropic.model'),
                'max_tokens' => 2048,
                'system' => "Tu assistes l'archivage de documents administratifs pour une association (Hetep Iaout Services). "
                    . "Analyse le document fourni et propose des métadonnées d'archivage précises, en français.",
                'messages' => [[
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => $typeBloc,
                            'source' => [
                                'type' => 'base64',
                                'media_type' => $mimeType,
                                'data' => $contenuBase64,
                            ],
                        ],
                        ['type' => 'text', 'text' => "Propose les métadonnées d'archivage pour ce document via l'outil fourni."],
                    ],
                ]],
                'tools' => [$outil],
                'tool_choice' => ['type' => 'tool', 'name' => 'proposer_metadonnees_document'],
            ]);

            if (!$reponse->successful()) {
                Log::warning('DocumentAnalysisIAService::analyserFichier — appel API échoué', ['status' => $reponse->status()]);
                return null;
            }

            return $this->extraireInputOutil($reponse->json(), 'proposer_metadonnees_document');
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
        $apiKey = config('services.anthropic.api_key');
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

        $outil = [
            'name' => 'suggerer_transmission',
            'description' => 'Suggère à quel(s) service(s) transmettre ce document.',
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'service_codes' => [
                        'type' => 'array',
                        'items' => ['type' => 'string', 'enum' => $servicesDisponibles],
                        'description' => 'Codes des services concernés, uniquement parmi la liste fournie.',
                    ],
                    'justification' => ['type' => 'string', 'description' => 'Courte justification en français (une phrase).'],
                ],
                'required' => ['service_codes', 'justification'],
            ],
        ];

        try {
            $reponse = Http::withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => self::API_VERSION,
            ])->timeout(30)->post(self::API_URL, [
                'model' => config('services.anthropic.model'),
                'max_tokens' => 512,
                'system' => "Tu assistes le routage de documents administratifs pour une association (Hetep Iaout Services). "
                    . "Tu ne dois choisir que parmi les codes de service fournis, jamais en inventer.",
                'messages' => [[
                    'role' => 'user',
                    'content' => 'Services disponibles : ' . implode(', ', $servicesDisponibles)
                        . "\n\nContenu du document :\n" . mb_substr($contenu, 0, 8000),
                ]],
                'tools' => [$outil],
                'tool_choice' => ['type' => 'tool', 'name' => 'suggerer_transmission'],
            ]);

            if (!$reponse->successful()) {
                Log::warning('DocumentAnalysisIAService::suggererTransmission — appel API échoué', ['status' => $reponse->status()]);
                return null;
            }

            $resultat = $this->extraireInputOutil($reponse->json(), 'suggerer_transmission');
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

    private function extraireInputOutil(array $reponseJson, string $nomOutil): ?array
    {
        foreach ($reponseJson['content'] ?? [] as $bloc) {
            if (($bloc['type'] ?? null) === 'tool_use' && ($bloc['name'] ?? null) === $nomOutil) {
                return $bloc['input'] ?? null;
            }
        }
        return null;
    }
}
