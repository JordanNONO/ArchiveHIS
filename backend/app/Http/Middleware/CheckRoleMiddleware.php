<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  $role
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next, $role)
    {
        // Vérifier si l'utilisateur est authentifié
        if (!Auth::check()) {
            return response()->json(['message' => 'Non autorisé'], 401);
        }

        // Récupérer le rôle de l'utilisateur authentifié
        $userRole = Auth::user()->role;

        // Vérifier si le rôle de l'utilisateur correspond au rôle requis
        if ($userRole === $role) {
            return $next($request);
        }

        return response()->json(['message' => 'Non autorisé'], 403);
    }
}
