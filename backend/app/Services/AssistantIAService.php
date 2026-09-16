<?php

namespace App\Services;

use App\Models\DocumentArchive;
use App\Models\Utilisateurs;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Assistant conversationnel (Claude, en boucle avec outil) qui aide le
 * personnel interne à retrouver/comprendre des documents archivés en langage
 * naturel — pas un simple "analyse ce fichier" comme DocumentAnalysisIAService,
 * mais un vrai échange à plusieurs tours qui peut chercher plusieurs fois
 * avant de répondre. Volontairement en LECTURE SEULE pour cette première
 * version (aucun outil de création/modification) : l'IA ne fait que
 * retrouver et résumer, jamais agir à la place de l'utilisateur.
 *
 * Ne renvoie JAMAIS un document que l'utilisateur ne devrait pas voir — la
 * recherche interne passe systématiquement par VisibiliteDocumentService,
 * exactement comme DocumentController::recherche().
 */
class AssistantIAService
{
    private const API_URL = 'https://api.anthropic.com/v1/messages';
    private const API_VERSION = '2023-06-01';

    // Nombre max d'allers-retours "outil" avant de forcer une réponse texte —
    // évite qu'une question ambiguë ne fasse boucler l'IA indéfiniment (coût +
    // latence), un usage normal ne cherche qu'une ou deux fois.
    private const MAX_TOURS_OUTIL = 4;
    private const MAX_RESULTATS_RECHERCHE = 8;

    private array $documentsTrouves = [];

    /**
     * @param array $historique Liste ordonnée de ['role' => 'user'|'assistant', 'contenu' => string]
     *                          — les tours précédents de CETTE conversation, sans les détails d'outil
     *                          (reconstruits ici à chaque appel, plus simple que de sérialiser les blocs
     *                          tool_use/tool_result d'un tour à l'autre côté client).
     * @return array{reponse: string, documents: array}|null null si indisponible (clé absente, erreur API).
     */
    public function repondre(array $historique, string $message, Utilisateurs $utilisateur): ?array
    {
        $apiKey = config('services.anthropic.api_key');
        if (!$apiKey) {
            return null;
        }

        $this->documentsTrouves = [];

        $messages = [];
        foreach ($historique as $tour) {
            if (($tour['role'] ?? null) === 'user' || ($tour['role'] ?? null) === 'assistant') {
                $messages[] = ['role' => $tour['role'], 'content' => (string) ($tour['contenu'] ?? '')];
            }
        }
        $messages[] = ['role' => 'user', 'content' => $message];

        $outil = [
            'name' => 'rechercher_documents',
            'description' => "Recherche des documents déjà archivés par mots-clés (titre, résumé, objet, référence, contenu lu par OCR). Ne retourne que les documents visibles par l'utilisateur actuel, au plus " . self::MAX_RESULTATS_RECHERCHE . " résultats les plus pertinents.",
            'input_schema' => [
                'type' => 'object',
                'properties' => [
                    'mots_cles' => ['type' => 'string', 'description' => 'Mots-clés de recherche, en français (ex: "fiche de paie Untel 2026").'],
                ],
                'required' => ['mots_cles'],
            ],
        ];

        $system = "Tu es l'assistant documentaire interne de Hetep Iaout Services (association d'aide à domicile). "
            . "Tu aides le personnel à retrouver et comprendre des documents déjà archivés dans le système. "
            . "Utilise l'outil rechercher_documents dès qu'une question porte sur un document précis, une personne, "
            . "une date, une référence ou un sujet — ne réponds jamais de mémoire sur le contenu d'un document, "
            . "cherche toujours d'abord. Si la recherche ne renvoie rien, dis-le clairement plutôt que d'inventer. "
            . "Réponds toujours en français, de façon concise et directe. Ne mentionne pas les identifiants techniques "
            . "(ID, chemins de fichier) : le titre et la référence suffisent, l'interface affiche déjà des liens cliquables "
            . "vers les documents trouvés, inutile de les répéter sous forme d'URL.";

        try {
            for ($tour = 0; $tour < self::MAX_TOURS_OUTIL; $tour++) {
                $reponse = Http::withHeaders([
                    'x-api-key' => $apiKey,
                    'anthropic-version' => self::API_VERSION,
                ])->timeout(45)->post(self::API_URL, [
                    'model' => config('services.anthropic.model'),
                    'max_tokens' => 1024,
                    'system' => $system,
                    'messages' => $messages,
                    'tools' => [$outil],
                ]);

                if (!$reponse->successful()) {
                    Log::warning('AssistantIAService::repondre — appel API échoué', ['status' => $reponse->status()]);
                    return null;
                }

                $json = $reponse->json();
                $contenu = $json['content'] ?? [];
                $messages[] = ['role' => 'assistant', 'content' => $contenu];

                if (($json['stop_reason'] ?? null) !== 'tool_use') {
                    return [
                        'reponse' => $this->extraireTexte($contenu),
                        'documents' => array_values($this->documentsTrouves),
                    ];
                }

                $resultatsOutils = [];
                foreach ($contenu as $bloc) {
                    if (($bloc['type'] ?? null) !== 'tool_use') {
                        continue;
                    }
                    $resultats = $this->rechercherDocuments((string) ($bloc['input']['mots_cles'] ?? ''), $utilisateur);
                    $resultatsOutils[] = [
                        'type' => 'tool_result',
                        'tool_use_id' => $bloc['id'],
                        'content' => json_encode($resultats, JSON_UNESCAPED_UNICODE),
                    ];
                }
                $messages[] = ['role' => 'user', 'content' => $resultatsOutils];
            }

            // Limite de tours atteinte (cas rare) : ce qui a déjà été trouvé
            // reste utile à afficher même sans synthèse texte de l'IA.
            return [
                'reponse' => 'Voici ce que j\'ai trouvé.',
                'documents' => array_values($this->documentsTrouves),
            ];
        } catch (\Throwable $e) {
            Log::warning('AssistantIAService::repondre — exception', ['message' => $e->getMessage()]);
            return null;
        }
    }

    private function extraireTexte(array $contenu): string
    {
        $texte = '';
        foreach ($contenu as $bloc) {
            if (($bloc['type'] ?? null) === 'text') {
                $texte .= ($texte === '' ? '' : "\n") . ($bloc['text'] ?? '');
            }
        }
        return $texte;
    }

    /**
     * Même logique de recherche que DocumentController::recherche() (FULLTEXT
     * booléen + repli LIKE pour les requêtes courtes) — dupliquée volontairement
     * plutôt que dépendre du contrôleur HTTP depuis un service, voir aussi le
     * commentaire de recherche() sur pourquoi ce choix de mode.
     */
    private function rechercherDocuments(string $motsCles, Utilisateurs $utilisateur): array
    {
        $q = trim($motsCles);
        if ($q === '') {
            return [];
        }

        $query = DocumentArchive::with('categorieDocument', 'typeDocument');

        $mots = preg_split('/\s+/', $q, -1, PREG_SPLIT_NO_EMPTY);
        $motsIndexables = [];
        foreach ($mots as $mot) {
            $motNettoye = preg_replace('/[+\-<>~*"()]/', '', $mot);
            if (mb_strlen($motNettoye) >= 3) {
                $motsIndexables[] = $motNettoye;
            }
        }

        if (mb_strlen($q) < 4 || empty($motsIndexables)) {
            $query->where('texte_recherche', 'like', '%' . $q . '%');
        } else {
            $requeteBooleenne = implode(' ', array_map(fn ($m) => '+' . $m . '*', $motsIndexables));
            $query->whereFullText('texte_recherche', $requeteBooleenne, ['mode' => 'boolean']);
        }

        (new VisibiliteDocumentService())->restreindre($query, $utilisateur);

        $documents = $query
            ->orderByRaw('MATCH(texte_recherche) AGAINST(?) DESC', [$q])
            ->limit(self::MAX_RESULTATS_RECHERCHE)
            ->get();

        $resultats = [];
        foreach ($documents as $document) {
            $resume = [
                'id' => $document->id,
                'titre' => $document->titre_document,
                'reference' => $document->code_reference,
                'extension' => strtolower(pathinfo((string) $document->chemin_stockage_serveur, PATHINFO_EXTENSION)) ?: 'pdf',
                'categorie' => $document->categorieDocument?->libelle_cat,
                'type' => $document->typeDocument?->libelle,
                'auteur' => $document->auteur,
                'date_archivage' => (string) ($document->date_archivage ?? $document->created_at?->toDateString()),
                'resume' => mb_substr((string) $document->resume, 0, 300),
            ];
            // Clé sur l'ID : dédoublonne naturellement si le même document
            // ressort de plusieurs recherches successives dans la même conversation.
            $this->documentsTrouves[$document->id] = $resume;
            $resultats[] = $resume;
        }

        return $resultats;
    }
}
