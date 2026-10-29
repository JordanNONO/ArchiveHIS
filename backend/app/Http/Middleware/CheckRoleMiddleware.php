<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRoleMiddleware
{
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $user = auth('api')->user();

        if (!$user) {
            return response()->json(['error' => "Vous n'êtes pas habilité à effectuer cette action."], 401);
        }

        if (!$user->roles()->where('nom', $role)->exists()) {
            return response()->json(['error' => "Vous n'êtes pas habilité à effectuer cette action."], 403);
        }

        return $next($request);
    }
}
