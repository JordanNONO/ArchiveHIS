<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermissionMiddleware
{
    /**
     * Plusieurs permissions séparées par une virgule ("permission:a,b") sont
     * acceptées, et il suffit d'en détenir UNE : c'est ainsi qu'une même
     * page peut être ouverte à un droit de gestion et à un droit de simple
     * consultation (voir les routes de la fluctuation RH).
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = auth('api')->user();

        if (!$user) {
            return response()->json(['error' => "Vous n'êtes pas habilité à effectuer cette action."], 401);
        }

        foreach ($permissions as $permission) {
            if ($user->hasPermission($permission)) {
                return $next($request);
            }
        }

        return response()->json(['error' => "Vous n'êtes pas habilité à effectuer cette action."], 403);
    }
}
