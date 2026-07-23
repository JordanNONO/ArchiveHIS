<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\Personnels;
use App\Models\Utilisateurs;
use App\Models\UserRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class PersonnelController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $personnel = Personnels::with("bureau", "user.roles")->get();
        return response()->json($personnel, 200);
    }
    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'nom_pers' => 'required|string',
            'prenom_pers' => 'required|string',
            'first_phone_pers' => 'required|string',
            'email' => 'required|string|email|unique:utilisateurs,mail',
            'bureau_id' => 'required|exists:bureaux,id',
            'role_id' => 'required|exists:roles,id', // Assuming you have a 'roles' table with 'id' as primary key
        ]);
        try {
            DB::beginTransaction();
            // Create Utilisateurs entry for personnel
            $user = Utilisateurs::create([
                'nom' => $validatedData['nom_pers'] . ' ' . $validatedData['prenom_pers'],
                'mail' => $validatedData['email'],
                'password' => Hash::make($validatedData['first_phone_pers']),

            ]);
            UserRole::create([
                'role_id' => $validatedData['role_id'],
                'utilisateur_id' => $user->id,
            ]);
            // Create Personnel entry
            $personnel = Personnels::create([
                'utilisateur_id' => $user->id,
                'nom' => $validatedData['nom_pers'],
                'prenom' => $validatedData['prenom_pers'],
                'bureau_id' => $validatedData['bureau_id'],
            ]);

            DB::commit();
            return response()->json($personnel, 201);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json(['error' => 'Erreur d\'enregistrement: ' . $th->getMessage()], 500);
        }
    }
    /**
     * Display the specified resource.
     */
    public function show()
    {
        $id = auth('api')->id();
        $personnel = Personnels::where('utilisateur_id', '=', $id)->first();
        return response()->json($personnel, 200);
    }
    public function updateProfile(Request $request)
    {
        // Validate the request
        $validate = $request->validate([
            'file' => 'required|mimetypes:image/png,image/jpg,image/jpeg|max:2048'
        ]);

        // Get the authenticated user's ID
        $id = auth('api')->id();

        // Find the personnel associated with the user
        $personnel = Personnels::where('utilisateur_id', $id)->first();

        // Check if the personnel record exists
        if (!$personnel) {
            return response()->json(["message" => "Personnel not found"], 404);
        }

        // Check if the request contains a file
        if ($request->hasFile('file')) {
            try {
                // Store the file in the public disk
                $file = $request->file('file');
                $path = $file->store('profile', 'public');

                // Update the personnel's photo path
                $validate['photo'] = $path;
                $personnel->update($validate);

                return response()->json(["message" => "Profile updated"], 200);
            } catch (\Exception $e) {
                // Handle any errors during the file storage or update process
                return response()->json(["message" => "An error occurred while updating the profile"], 500);
            }
        }

        return response()->json(["message" => "File not provided"], 400);
    }
    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request)
    {
        $validatedData = $request->validate([
            'nom' => 'required|string',
            'prenom' => 'required|string',
            'sexe' => 'required|string',
            'date_naissance' => 'required|date',
            'lieu_naissance' => 'required|string',
            'statut_mat' => 'required|string',
            'lieu_residence' => 'required|string',
            'first_phone' => 'required|string',
            'second_phone' => 'nullable|string',
            'cni' => 'required|string',
            'lang' => 'nullable|string',
            'bibliographie' => 'nullable|string',
            'nb_enfant' => 'nullable|integer',
        ]);

        try {
            DB::beginTransaction();
            $id = auth('api')->id();
            $personnel = Personnels::where('utilisateur_id', $id)->first();

            if (!$personnel) {
                return response()->json(['error' => 'Personnel not found'], 404);
            }

            $personnel->update($validatedData);
            DB::commit();

            // Retrieve the updated personnel data
            $updatedPersonnel = Personnels::where('utilisateur_id', $id)->first();

            return response()->json(['message' => 'Personnel mis à jour avec succès', 'personnel' => $updatedPersonnel], 200);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json(['error' => 'Erreur de mise à jour: ' . $th->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy()
    {
        try {
            DB::beginTransaction();
            $id = auth('api')->id();
            $personnel = Personnels::where('utilisateur_id', '=', $id)->firstOrFail();
            // Delete associated Utilisateurs entry
            $user = Utilisateurs::findOrFail($personnel->utilisateur_id);
            $user->delete();
            $personnel->delete();
            DB::commit();
            return response()->json(['message' => 'Personnel supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json(['error' => 'Erreur de suppression: ' . $th->getMessage()], 500);
        }
    }

    /**
     * Update d'un personnel par un administrateur (nom, prénom, bureau, rôle).
     */
    public function updateById(Request $request, int $id)
    {
        $validatedData = $request->validate([
            'nom' => 'sometimes|string',
            'prenom' => 'sometimes|string',
            'bureau_id' => 'sometimes|exists:bureaux,id',
            'role_id' => 'sometimes|exists:roles,id',
        ]);

        try {
            DB::beginTransaction();
            $personnel = Personnels::findOrFail($id);
            $personnel->update(collect($validatedData)->except('role_id')->toArray());

            if (isset($validatedData['role_id'])) {
                UserRole::where('utilisateur_id', $personnel->utilisateur_id)->delete();
                UserRole::create([
                    'utilisateur_id' => $personnel->utilisateur_id,
                    'role_id' => $validatedData['role_id'],
                ]);
            }

            DB::commit();
            return response()->json($personnel->fresh('bureau', 'user.roles'), 200);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json(['error' => 'Erreur de mise à jour: ' . $th->getMessage()], 500);
        }
    }

    /**
     * Suppression d'un personnel par un administrateur.
     */
    public function destroyById(int $id)
    {
        try {
            DB::beginTransaction();
            $personnel = Personnels::findOrFail($id);
            $user = Utilisateurs::find($personnel->utilisateur_id);
            $personnel->delete();
            if ($user) {
                $user->delete();
            }
            DB::commit();
            return response()->json(['message' => 'Personnel supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollBack();
            return response()->json(['error' => 'Erreur de suppression: ' . $th->getMessage()], 500);
        }
    }
}
