<?php

namespace App\Http\Controllers;

use App\Models\Bureaux;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BureauController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $bureaux = Bureaux::all();
        return response()->json($bureaux, 200);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
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
            return response()->json(['error' => "Erreur d'enregistrement: " . $th->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(int $id)
    {
        $bureau = Bureaux::findOrFail($id);
        return response()->json($bureau, 200);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(int $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
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
            return response()->json(['error' => "Erreur de mise à jour: " . $th->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $id)
    {
        try {
            DB::beginTransaction();
            $bureau = Bureaux::findOrFail($id);
            $bureau->delete();
            DB::commit();
            return response()->json(['message' => 'Bureau supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }
}
