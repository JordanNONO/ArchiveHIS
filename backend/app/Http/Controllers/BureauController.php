<?php

namespace App\Http\Controllers;

use App\Models\Bureaux;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BureauController extends Controller
{
    public function index()
    {
        $bureaux = Bureaux::all();
        return response()->json($bureaux, 200);
    }

    public function create()
    {
        //
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'name' => 'required|string|max:255|unique:bureaux',
        ]);

        try {
            DB::beginTransaction();
            $bureau = Bureaux::create($validatedData);
            DB::commit();
            return response()->json($bureau, 201);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "L'enregistrement a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    public function show(int $id)
    {
        $bureau = Bureaux::findOrFail($id);
        return response()->json($bureau, 200);
    }

    public function edit(int $id)
    {
        //
    }

    public function update(Request $request, int $id)
    {
        $validatedData = $request->validate([
            'name' => 'required|string|max:255',
        ]);

        try {
            $bureau = Bureaux::findOrFail($id);
            $bureau->update($validatedData);
            return response()->json($bureau, 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "La mise à jour a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    public function destroy(int $id)
    {
        try {
            DB::beginTransaction();
            $bureau = Bureaux::findOrFail($id);

            // La contrainte de clé étrangère de personnels.bureau_id est en cascade :
            // supprimer le bureau supprimerait silencieusement tout le personnel qui y
            // est rattaché. On bloque explicitement ce cas plutôt que de risquer une
            // perte de données.
            $nbPersonnel = $bureau->personnels()->count();
            if ($nbPersonnel > 0) {
                DB::rollback();
                return response()->json([
                    'error' => "Ce bureau contient encore {$nbPersonnel} membre(s) du personnel. Réaffectez-les avant de le supprimer.",
                ], 409);
            }

            $bureau->delete();
            DB::commit();
            return response()->json(['message' => 'Bureau supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "La suppression a échoué. Réessayez dans quelques instants."], 500);
        }
    }
}
