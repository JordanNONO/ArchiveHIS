<?php

namespace App\Http\Controllers;

use App\Enums\StatutDocument;
use App\Jobs\GenererZipDossier;
use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\FolderExport;
use App\Models\Share;
use App\Models\TypeDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategorieController extends Controller
{

    /**
     * Display a listing of the resource.
     *
     * Chaque catégorie renvoie, en plus du total, une répartition de ses documents
     * par groupe de statut (attention/en_cours/traite) pour permettre au frontend
     * d'afficher un indicateur "feu tricolore" par dossier sans requête supplémentaire.
     */
    public function index()
    {
        $categories = CategorieDocument::withCount([
            'documentArchives',
            'documentArchives as documents_attention_count' => function ($query) {
                $query->whereIn('status_doc', StatutDocument::parGroupe('attention'));
            },
            'documentArchives as documents_en_cours_count' => function ($query) {
                $query->whereIn('status_doc', StatutDocument::parGroupe('en_cours'));
            },
            'documentArchives as documents_traites_count' => function ($query) {
                $query->whereIn('status_doc', StatutDocument::parGroupe('traite'));
            },
        ])->get();

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
        $docs = DocumentArchive::where("categorie_id", '=', $id_cat)->with('typeDocument', 'personnelConcerne')->get();
        $types = TypeDocument::where('categorie_id', $id_cat)->withCount('documentArchives')->orderBy('libelle')->get();
        return response()->json(['dossier' => $categorie, 'documents' => $docs, 'types' => $types], 200);
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
            // Les documents sont stockés dans des dossiers basés sur l'identifiant
            // de la catégorie (voir DocumentController::store), jamais sur son
            // libellé affiché : renommer une catégorie est une simple mise à jour
            // de base de données, aucun fichier n'a besoin d'être déplacé.
            $categorie = CategorieDocument::findOrFail($id_cat);
            $categorie->update(['libelle_cat' => $validatedData['label']]);
            return response()->json($categorie, 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => "Erreur de mise à jour: " . $th->getMessage()], 500);
        }
    }

    /**
     * Demande le téléchargement de tous les documents d'une catégorie : génère le
     * ZIP en tâche de fond (voir GenererZipDossier) plutôt que de bloquer la requête,
     * et prévient l'utilisateur par notification quand l'archive est prête.
     */
    public function download(int $id_cat)
    {
        $categorie = CategorieDocument::findOrFail($id_cat);
        $nombreDocuments = DocumentArchive::where('categorie_id', $id_cat)->count();

        if ($nombreDocuments === 0) {
            return response()->json(['error' => 'Ce dossier ne contient aucun document.'], 422);
        }

        $export = FolderExport::create([
            'utilisateur_id' => auth('api')->id(),
            'categorie_id' => $categorie->id,
            'nom_dossier' => $categorie->libelle_cat,
            'statut' => 'en_attente',
        ]);

        GenererZipDossier::dispatch($export);

        return response()->json([
            'message' => "Préparation de l'archive en cours, vous serez notifié quand elle sera prête.",
            'export' => $export,
        ], 202);
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
