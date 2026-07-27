<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Personnels;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    /**
     * Authenticate the personnel.
     */
    public function authenticate(Request $request)
    {
        $validatedData = $request->validate([
            'login' => 'required|string',
            'password' => 'required|string',
        ]);
        $admin_cred = ['mail' => $validatedData['login'], 'password' => $validatedData['password']];
        $token = auth('api')->attempt($admin_cred);
        if (!$token) {
            return response()->json(['message' => 'Identifiants incorrects'], 401);
        }
        return $this->respondWithToken($token);
    }

    public function logout(Request $request)
    {
        auth("api")->logout();
        return response()->json(["message" => "Déauthentification réussie"]);
    }

    public function me()
    {
        $user = auth("api")->user();
        $roles = $user->roles()->with('permissions')->get();
        $role = $roles->pluck('nom')->first();
        $personnel = Personnels::where("utilisateur_id", $user->id)->first();

        if (!$personnel) {
            return response()->json([
                'message' => 'Personnel not found',
            ], 404);
        }

        $photoUrl = $personnel->photo ? Storage::url($personnel->photo) : null;

        return response()->json([
            'user' => $user,
            'profile' => $photoUrl,
            'personnel' => $personnel,
            'role' => $role,
            'permissions' => $roles->pluck('permissions')->flatten()->pluck('code_perm')->unique()->values(),
            'token' => JWTAuth::refresh(),
        ]);
    }

    public function update(Request $request)
    {
        $validatedData = $request->validate([
            'email' => 'required|email|unique:utilisateurs,mail,' . auth('api')->id(),
            'password' => 'nullable|string|min:8',
        ]);

        $utilisateur = auth("api")->user();
        $data = ['mail' => $validatedData['email']];

        if (!empty($validatedData['password'])) {
            $data['password'] = Hash::make($validatedData['password']);
        }

        $utilisateur->update($data);

        return response()->json(['message' => 'Informations de connexion mises à jour avec succès'], 200);
    }
    public function refresh()
    {
        return $this->respondWithToken(JWTAuth::refresh());
    }

    protected function respondWithToken($token)
    {
        return response()->json([
            'token' => $token,
            'token_type' => 'bearer',
            "message" => "Connexion réussie",
            'expires_in' => JWTAuth::factory()->getTTL() * 60
        ]);
    }
}
