<?php

namespace App\Http\Controllers;

use App\Models\AssistantMessage;
use App\Services\AssistantIAService;
use Illuminate\Http\Request;

/**
 * Assistant documentaire conversationnel (bulle de chat, voir AssistantChat.jsx)
 * — réservé au personnel interne : un compte dépôt (intervenant/bénéficiaire)
 * n'a pas cette bulle dans l'interface, mais on bloque aussi ici côté API,
 * comme partout ailleurs où l'accès dépend du type de compte plutôt que
 * d'une simple permission.
 *
 * L'historique est désormais persisté par personne (voir assistant_messages) —
 * source de vérité côté serveur, jamais reconstruit à partir de ce que le
 * client prétend avoir échangé auparavant.
 */
class AssistantController extends Controller
{
    // Nombre de messages conservés par personne (utilisateur + assistant
    // confondus) — au-delà, les plus anciens sont supprimés (même principe
    // que DocumentController::elaguerAnciennesVersions()) : assez pour
    // garder le fil d'une session de travail, sans grossir indéfiniment ni
    // alourdir le contexte renvoyé à Claude à chaque nouveau message.
    private const LIMITE_HISTORIQUE = 40;

    public function historique()
    {
        $utilisateur = auth('api')->user();
        if ($utilisateur->estCompteDepot()) {
            return response()->json(['error' => "Cette fonctionnalité n'est pas disponible sur ce compte."], 403);
        }

        $messages = AssistantMessage::where('utilisateur_id', $utilisateur->id)
            ->orderBy('id')
            ->get(['role', 'contenu', 'documents']);

        return response()->json($messages, 200);
    }

    public function effacerHistorique()
    {
        $utilisateur = auth('api')->user();
        if ($utilisateur->estCompteDepot()) {
            return response()->json(['error' => "Cette fonctionnalité n'est pas disponible sur ce compte."], 403);
        }

        AssistantMessage::where('utilisateur_id', $utilisateur->id)->delete();

        return response()->json(['message' => 'Historique effacé'], 200);
    }

    public function repondre(Request $request, AssistantIAService $service)
    {
        $utilisateur = auth('api')->user();
        if ($utilisateur->estCompteDepot()) {
            return response()->json(['error' => "Cette fonctionnalité n'est pas disponible sur ce compte."], 403);
        }

        $validated = $request->validate([
            'message' => 'required|string|max:2000',
        ]);

        $historique = AssistantMessage::where('utilisateur_id', $utilisateur->id)
            ->orderBy('id')
            ->get(['role', 'contenu'])
            ->map(fn ($m) => ['role' => $m->role, 'contenu' => $m->contenu])
            ->all();

        $resultat = $service->repondre($historique, $validated['message'], $utilisateur);

        AssistantMessage::create([
            'utilisateur_id' => $utilisateur->id,
            'role' => 'user',
            'contenu' => $validated['message'],
        ]);

        if ($resultat === null) {
            AssistantMessage::create([
                'utilisateur_id' => $utilisateur->id,
                'role' => 'assistant',
                'contenu' => "L'assistant n'est pas disponible pour le moment.",
            ]);
            $this->elaguerHistorique($utilisateur->id);

            return response()->json([
                'disponible' => false,
                'reponse' => "L'assistant n'est pas disponible pour le moment.",
                'documents' => [],
            ], 200);
        }

        AssistantMessage::create([
            'utilisateur_id' => $utilisateur->id,
            'role' => 'assistant',
            'contenu' => $resultat['reponse'],
            'documents' => $resultat['documents'],
        ]);
        $this->elaguerHistorique($utilisateur->id);

        return response()->json(['disponible' => true, ...$resultat], 200);
    }

    private function elaguerHistorique(int $utilisateurId): void
    {
        $aSupprimer = AssistantMessage::where('utilisateur_id', $utilisateurId)
            ->orderByDesc('id')
            ->skip(self::LIMITE_HISTORIQUE)
            ->take(PHP_INT_MAX)
            ->pluck('id');
        if ($aSupprimer->isNotEmpty()) {
            AssistantMessage::whereIn('id', $aSupprimer)->delete();
        }
    }
}
