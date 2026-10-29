<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermissionMiddleware
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $user = auth('api')->user();

        if (!$user) {
            return response()->json(['error' => "Vous n'êtes pas habilité à effectuer cette action."], 401);
        }

        if (!$user->hasPermission($permission)) {
            return response()->json(['error' => "Vous n'êtes pas habilité à effectuer cette action."], 403);
        }

        return $next($request);
    }
}
