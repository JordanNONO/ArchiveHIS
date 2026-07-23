<?php

namespace App\Http\Controllers;

use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\Share;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class CategorieController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $categories = CategorieDocument::all();
        return response()->json($categories, 200);
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
            'label' => 'required|string|max:255|unique:categorie_documents,libelle_cat',
        ]);
        try {
            DB::beginTransaction();
            $categorie = CategorieDocument::create(['libelle_cat' => $validatedData['label']]);
            DB::commit();
            return response()->json($categorie, 201);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur d'enregistrement: " . $th->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(int $id_cat)
    {
        $categorie = CategorieDocument::findOrFail($id_cat);
        $docs = DocumentArchive::where("categorie_id", '=', $id_cat)->get();
        return response()->json(['dossier' => $categorie, 'documents' => $docs], 200);
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
    public function update(Request $request, int $id_cat)
    {
        $validatedData = $request->validate([
            'label' => ['required', 'string', 'max:255', Rule::unique('categorie_documents', 'libelle_cat')->ignore($id_cat)],
        ]);

        try {
            $categorie = CategorieDocument::findOrFail($id_cat);
            if (Storage::disk('sftp')->exists($categorie->libelle_cat)) {
                Storage::disk("sftp")->move($categorie->libelle_cat, $validatedData['label']);
            }
            $categorie->update(['libelle_cat' => $validatedData['label']]);
            return response()->json($categorie, 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => "Erreur de mise à jour: " . $th->getMessage()], 500);
        }
    }

    public function share(Request $request, CategorieDocument $folder)
    {
        Share::create([

        ]);

        return response()->json(['message' => 'Folder shared successfully.']);
    }

    public function favorite(Request $request, CategorieDocument $folder)
    {
        // Logic to add the folder to the user's favorites
        $user = auth('api')->user();
        $user->favoriteFolders()->attach($folder);

        return response()->json(['message' => 'Folder favorited successfully.']);
    }

    public function unfavorite(Request $request, CategorieDocument $folder)
    {
        // Logic to remove the folder from the user's favorites
        $user = auth('api')->user();
        $user->favoriteFolders()->detach($folder);

        return response()->json(['message' => 'Folder unfavorited successfully.']);
    }
    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $id_cat)
    {
        try {
            DB::beginTransaction();
            $categorie = CategorieDocument::findOrFail($id_cat);
            $categorie->delete();
            DB::commit();
            return response()->json(['message' => 'Catégorie supprimée avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }
}
