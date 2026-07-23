<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  $role
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next, string $role): Response
    {
        $user = auth('api')->user();

        if (!$user) {
            return response()->json(['message' => 'Non autorisé'], 401);
        }

        if (!$user->roles()->where('nom', $role)->exists()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        return $next($request);
    }
}
