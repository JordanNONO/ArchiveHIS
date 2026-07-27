<?php

namespace App\Http\Controllers;

use App\Jobs\GenererZipDossier;
use App\Models\DocumentArchive;
use App\Models\FolderExport;
use App\Models\TypeDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TypeDocumentController extends Controller
{

    /**
     * Liste des sous-catégories (types de documents), optionnellement filtrée par catégorie parente.
     */
    public function index(Request $request)
    {
        $query = TypeDocument::withCount('documentArchives');

        if ($request->has('categorie_id')) {
            $query->where('categorie_id', $request->query('categorie_id'));
        }

        return response()->json($query->orderBy('libelle')->get(), 200);
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'categorie_id' => 'required|integer|exists:categorie_documents,id',
            'libelle' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
        ]);

        try {
            DB::beginTransaction();
            $type = TypeDocument::create($validatedData);
            DB::commit();
            return response()->json($type, 201);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur d'enregistrement: " . $th->getMessage()], 500);
        }
    }

    public function update(Request $request, int $id)
    {
        $validatedData = $request->validate([
            'libelle' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
        ]);

        try {
            $type = TypeDocument::findOrFail($id);
            $type->update($validatedData);
            return response()->json($type, 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => "Erreur de mise à jour: " . $th->getMessage()], 500);
        }
    }

    public function destroy(int $id)
    {
        try {
            DB::beginTransaction();
            $type = TypeDocument::findOrFail($id);
            $type->delete();
            DB::commit();
            return response()->json(['message' => 'Type de document supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }

    /**
     * Demande le téléchargement de tous les documents d'un sous-dossier : génère le
     * ZIP en tâche de fond et notifie l'utilisateur quand il est prêt.
     */
    public function download(int $id)
    {
        $type = TypeDocument::findOrFail($id);
        $nombreDocuments = DocumentArchive::where('type_document_id', $id)->count();

        if ($nombreDocuments === 0) {
            return response()->json(['error' => 'Ce dossier ne contient aucun document.'], 422);
        }

        $export = FolderExport::create([
            'utilisateur_id' => auth('api')->id(),
            'type_document_id' => $type->id,
            'nom_dossier' => $type->libelle,
            'statut' => 'en_attente',
        ]);

        GenererZipDossier::dispatch($export);

        return response()->json([
            'message' => "Préparation de l'archive en cours, vous serez notifié quand elle sera prête.",
            'export' => $export,
        ], 202);
    }
}
