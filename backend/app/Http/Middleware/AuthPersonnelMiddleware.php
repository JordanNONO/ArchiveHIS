<?php

namespace App\Http\Middleware;

use App\Models\ApiToken;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Tymon\JWTAuth\Facades\JWTAuth;
use Exception;
use Symfony\Component\HttpFoundation\Response;

class AuthPersonnelMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Un agent/automatisation externe s'authentifie via `X-Api-Key`, jamais
        // via le JWT des sessions humaines — voir ApiTokenController. Un en-tête
        // présent mais invalide échoue immédiatement (pas de repli silencieux
        // vers le JWT, qui donnerait un message d'erreur trompeur).
        $cleApi = $request->header('X-Api-Key');
        if ($cleApi) {
            $jeton = ApiToken::whereNull('revoque_le')
                ->where('jeton_hash', hash('sha256', $cleApi))
                ->first();

            if (!$jeton) {
                return response()->json(['message' => 'Clé API invalide ou révoquée'], 401);
            }

            $user = $jeton->utilisateur;
            if (!$user) {
                return response()->json(['message' => 'Utilisateur introuvable'], 401);
            }

            auth('api')->setUser($user);
            auth()->setUser($user);

            // Best-effort, comme le "dernier_vu_le" plus bas — un souci d'écriture
            // ne doit jamais faire échouer la requête elle-même.
            try {
                $jeton->forceFill(['dernier_utilise_le' => now()])->saveQuietly();
            } catch (Exception $e) {
                report($e);
            }

            return $next($request);
        }

        try {
            $user = JWTAuth::parseToken()->authenticate();

            // Le token est bien formé et pas expiré, mais authenticate() renvoie
            // `false` (pas d'exception) si l'utilisateur qu'il désigne n'existe
            // plus — ex: compte supprimé entre-temps alors qu'un onglet restait
            // connecté avec l'ancien token. Sans ce garde, setUser() plantait en
            // 500 (TypeError) au lieu d'un 401 propre.
            if (!$user) {
                return response()->json(['message' => 'Utilisateur introuvable'], 401);
            }

            // auth('api')->user() fonctionne déjà partout (JWTGuard résout le bearer
            // token à la demande), mais $request->user() et les mécanismes internes de
            // Laravel qui l'utilisent (dont l'authentification des canaux de diffusion
            // privés, voir routes/channels.php) lisent le garde PAR DÉFAUT ('web',
            // session, jamais utilisé ici). Sans cette ligne, ces mécanismes voient
            // toujours un utilisateur "non connecté" malgré un bearer token valide.
            auth()->setUser($user);
        } catch (Exception $e) {
            if ($e instanceof \Tymon\JWTAuth\Exceptions\TokenInvalidException) {
                return response()->json(['message' => 'Token invalide'], 401);
            } elseif ($e instanceof \Tymon\JWTAuth\Exceptions\TokenExpiredException) {
                return response()->json(['message' => 'Token expiré'], 401);
            } else {
                return response()->json(['message' => 'Token d\'autorisation non trouvé'], 401);
            }
        }

        // Un seul UPDATE toutes les minutes par utilisateur (pas à chaque requête)
        // pour savoir qui est "connecté" côté admin sans surcharger la base.
        if (!$user->dernier_vu_le || now()->diffInSeconds($user->dernier_vu_le) >= 60) {
            $user->timestamps = false;
            $user->forceFill(['dernier_vu_le' => now()])->save();
        }

        return $next($request);
    }
}
