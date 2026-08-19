<?php

namespace App\Http\Controllers;

use App\Models\ApiToken;
use App\Models\RoleUsers;
use App\Models\UserRole;
use App\Models\Utilisateurs;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Jetons d'API à portée large, pensés pour un agent externe (automatisation
 * de traitement de données) plutôt qu'un humain — voir la migration
 * create_api_tokens_table et AuthPersonnelMiddleware (en-tête `X-Api-Key`).
 * Résolu vers un compte de service dédié portant le rôle Administrator :
 * accès complet aux données via les mêmes règles qu'un vrai administrateur,
 * sans logique de contournement séparée. Réservé aux administrateurs —
 * générer un jeton à portée aussi large est une décision qui ne doit pas
 * être à la portée d'un rôle "Éditeur" quelconque.
 */
class ApiTokenController extends Controller
{
    /** Adresse fixe du compte de service partagé par tous les jetons — jamais utilisable pour se connecter (mot de passe aléatoire, jamais communiqué). */
    private const MAIL_COMPTE_AGENT = 'agent-api@interne.local';

    private function bloquerSiNonAdmin(): ?\Illuminate\Http\JsonResponse
    {
        if (!auth('api')->user()?->estAdministrateur()) {
            return response()->json(['error' => "Vous n'êtes pas habilité à effectuer cette action."], 403);
        }
        return null;
    }

    private function compteAgent(): Utilisateurs
    {
        $existant = Utilisateurs::where('mail', self::MAIL_COMPTE_AGENT)->first();
        if ($existant) {
            return $existant;
        }

        $roleAdmin = RoleUsers::where('nom', 'Administrator')->firstOrFail();

        return DB::transaction(function () use ($roleAdmin) {
            $agent = Utilisateurs::create([
                'nom' => 'Agent API (accès données)',
                'mail' => self::MAIL_COMPTE_AGENT,
                // Jamais utilisé pour se connecter (aucun jeton n'est émis pour ce
                // compte côté /auth) — un hash aléatoire suffit à satisfaire la
                // contrainte NOT NULL sans qu'aucun mot de passe réel n'existe.
                'password' => Hash::make(Str::random(64)),
            ]);
            UserRole::create(['utilisateur_id' => $agent->id, 'role_id' => $roleAdmin->id]);
            return $agent;
        });
    }

    public function index()
    {
        if ($reponse = $this->bloquerSiNonAdmin()) {
            return $reponse;
        }

        $jetons = ApiToken::with('creePar')
            ->orderByDesc('created_at')
            ->get()
            ->map(fn ($j) => [
                'id' => $j->id,
                'nom' => $j->nom,
                'prefixe' => $j->prefixe,
                'cree_par' => $j->creePar?->nom,
                'created_at' => $j->created_at,
                'dernier_utilise_le' => $j->dernier_utilise_le,
                'revoque_le' => $j->revoque_le,
            ]);

        return response()->json($jetons, 200);
    }

    public function store(Request $request)
    {
        if ($reponse = $this->bloquerSiNonAdmin()) {
            return $reponse;
        }

        $validated = $request->validate([
            'nom' => 'required|string|max:255',
        ]);

        $agent = $this->compteAgent();

        // 48 octets aléatoires en hexadécimal (96 caractères) — jamais stocké
        // en clair, seul le hash SHA-256 l'est (voir la migration). Un préfixe
        // "sk_" + 8 caractères reste affiché ensuite pour identifier le jeton
        // dans la liste sans jamais pouvoir en reconstituer le secret.
        $secret = 'sk_' . Str::random(64);
        $prefixe = substr($secret, 0, 11) . '…';

        $jeton = ApiToken::create([
            'nom' => $validated['nom'],
            'prefixe' => $prefixe,
            'jeton_hash' => hash('sha256', $secret),
            'utilisateur_id' => $agent->id,
            'cree_par_id' => auth('api')->id(),
        ]);

        return response()->json([
            'id' => $jeton->id,
            'nom' => $jeton->nom,
            'jeton' => $secret,
        ], 201);
    }

    public function destroy(int $id)
    {
        if ($reponse = $this->bloquerSiNonAdmin()) {
            return $reponse;
        }

        $jeton = ApiToken::findOrFail($id);
        $jeton->update(['revoque_le' => now()]);

        return response()->json(['message' => 'Jeton révoqué'], 200);
    }
}
