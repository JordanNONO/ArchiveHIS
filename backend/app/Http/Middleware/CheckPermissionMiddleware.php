<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;
use App\Models\RolePermission;

class CheckPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  $permission
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next, $permission)
    {
        // Vérifier si l'utilisateur est authentifié
        if (!Auth::check()) {
            return response()->json(['message' => 'Non autorisé'], 401);
        }

        $user = Auth::user();
        $roleId = $user->role_id; // Suppose que l'utilisateur a un attribut role_id

        // Vérifier si l'utilisateur a la permission requise
        $hasPermission = RolePermission::where('code_role', $roleId)
            ->where('code_permis', $permission)
            ->exists();

        if ($hasPermission) {
            return $next($request);
        }

        return response()->json(['message' => 'Permission refusée'], 403);
    }
}
