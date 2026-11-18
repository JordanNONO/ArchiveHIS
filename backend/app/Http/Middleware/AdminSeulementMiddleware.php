<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Réservé aux rôles Administrator et Super Administrateur (voir
 * Utilisateurs::estAdministrateur()) — distinct du système de permissions
 * (voir CheckPermissionMiddleware) : certaines actions, comme l'envoi
 * groupé des bulletins de paie par mail, ne doivent dépendre d'aucune
 * permission accordable à un rôle métier, seulement de ces deux rôles
 * précis (demande explicite 2026-11-18).
 */
class AdminSeulementMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = auth('api')->user();

        if (!$user || !$user->estAdministrateur()) {
            return response()->json(['error' => "Réservé aux administrateurs."], 403);
        }

        return $next($request);
    }
}
