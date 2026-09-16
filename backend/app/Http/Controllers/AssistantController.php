<?php

namespace App\Http\Controllers;

use App\Services\AssistantIAService;
use Illuminate\Http\Request;

/**
 * Assistant documentaire conversationnel (bulle de chat, voir AssistantChat.jsx)
 * — réservé au personnel interne : un compte dépôt (intervenant/bénéficiaire)
 * n'a pas cette bulle dans l'interface, mais on bloque aussi ici côté API,
 * comme partout ailleurs où l'accès dépend du type de compte plutôt que
 * d'une simple permission.
 */
class AssistantController extends Controller
{
    public function repondre(Request $request, AssistantIAService $service)
    {
        $utilisateur = auth('api')->user();
        if ($utilisateur->estCompteDepot()) {
            return response()->json(['error' => "Cette fonctionnalité n'est pas disponible sur ce compte."], 403);
        }

        $validated = $request->validate([
            'message' => 'required|string|max:2000',
            'historique' => 'nullable|array|max:20',
            'historique.*.role' => 'required_with:historique|string|in:user,assistant',
            'historique.*.contenu' => 'required_with:historique|string',
        ]);

        $resultat = $service->repondre($validated['historique'] ?? [], $validated['message'], $utilisateur);

        if ($resultat === null) {
            return response()->json([
                'disponible' => false,
                'reponse' => "L'assistant n'est pas disponible pour le moment.",
                'documents' => [],
            ], 200);
        }

        return response()->json(['disponible' => true, ...$resultat], 200);
    }
}
