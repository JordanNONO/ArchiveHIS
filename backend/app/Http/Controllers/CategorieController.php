<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\Document;
use App\Models\Share;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class CategorieController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $categories = Category::all();
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
            'label' => 'required|string|max:255|unique:categories,label',
        ]);
        try {
            DB::beginTransaction();
            $categorie = Category::create($validatedData);
            DB::commit();
            //Storage::disk("sftp")->makeDirectory($categorie['label']);
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
        $categorie = Category::findOrFail($id_cat);
        $docs = Document::where("category_id",'=',$id_cat)->get();
        return response()->json(['dossier'=>$categorie,'documents'=>$docs], 200);
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
            'label' => 'required|string|max:255|unique:categories,label',
        ]);

        try {
            $categorie = Category::findOrFail($id_cat);
           if (Storage::disk('sftp')->exists($categorie['label'])) {
            # code...
              Storage::disk("sftp")->move($categorie["label"],$validatedData['label']);
           }
            $categorie->update($validatedData);
            return response()->json($categorie, 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => "Erreur de mise à jour: " . $th->getMessage()], 500);
        }
    }
    public function share(Request $request, Category $folder)
    {
        Share::create([

        ]);
        
        return response()->json(['message' => 'Folder shared successfully.']);
    }

    public function favorite(Request $request,Category $folder)
    {
        // Logic to add the folder to the user's favorites
      $user = auth('api')->user();
        $user->favoriteFolders()->attach($folder);

        return response()->json(['message' => 'Folder favorited successfully.']);
    }

    public function unfavorite(Request $request, Category $folder)
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
            $categorie = Category::findOrFail($id_cat);
            $categorie->delete();
            DB::commit();
            return response()->json(['message' => 'Catégorie supprimée avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }
}
