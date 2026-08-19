<?php

namespace App\Http\Controllers;

use App\Jobs\GenererZipDossier;
use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\FolderExport;
use App\Models\TypeDocument;
use App\Services\VisibiliteDocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TypeDocumentController extends Controller
{

    /**
     * Liste des sous-catégories (types de documents), optionnellement filtrée par catégorie parente.
     * Le compteur est scopé à ce que l'utilisateur peut voir (voir VisibiliteDocumentService) —
     * les sous-dossiers restent tous listés, seuls les chiffres reflètent l'accès réel.
     */
    public function index(Request $request, VisibiliteDocumentService $visibilite)
    {
        $user = auth('api')->user();
        $query = TypeDocument::withCount(['documentArchives' => function ($q) use ($visibilite, $user) {
            $visibilite->restreindre($q, $user);
        }]);

        if ($request->has('categorie_id')) {
            $query->where('categorie_id', $request->query('categorie_id'));
        }

        return response()->json($query->orderBy('libelle')->get(), 200);
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'categorie_id' => 'required|integer|exists:categorie_documents,id',
            // Un sous-dossier imbriqué (ex: "Promesse d'embauche" créé depuis
            // l'intérieur de "CV") doit rester dans la même catégorie que son
            // parent — sans cette contrainte, on pourrait créer un dossier qui
            // pointe vers un parent d'une tout autre catégorie.
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists('type_documents', 'id')->where('categorie_id', $request->input('categorie_id')),
            ],
            'libelle' => 'required|string|max:255',
            'libelle_en' => 'nullable|string|max:255',
            'code' => 'nullable|string|max:50',
        ]);

        if (CategorieDocument::find($validatedData['categorie_id'])?->estVerrouille()) {
            return response()->json(['error' => 'Ce dossier est verrouillé — déverrouillez-le avant de créer un sous-dossier.'], 423);
        }

        try {
            DB::beginTransaction();
            $type = TypeDocument::create($validatedData);
            DB::commit();
            return response()->json($type, 201);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "L'enregistrement a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    public function update(Request $request, int $id)
    {
        $validatedData = $request->validate([
            'libelle' => 'required|string|max:255',
            'libelle_en' => 'nullable|string|max:255',
            'code' => 'nullable|string|max:50',
        ]);

        try {
            $type = TypeDocument::findOrFail($id);
            if ($type->categorieDocument?->estVerrouille()) {
                return response()->json(['error' => 'Ce dossier est verrouillé — déverrouillez-le avant de renommer ce sous-dossier.'], 423);
            }
            // Ne touche à la traduction que si elle est explicitement envoyée —
            // voir CategorieController::update() pour la même précaution.
            if (!$request->has('libelle_en')) {
                unset($validatedData['libelle_en']);
            }
            $type->update($validatedData);
            return response()->json($type, 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "La mise à jour a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    /**
     * Déplace un sous-dossier vers un autre parent — toujours dans la même
     * catégorie (les documents qu'il contient, direct ou imbriqués, gardent
     * leur chemin de stockage sur disque tel quel : seule la position dans
     * l'arborescence change, aucun fichier n'est déplacé).
     */
    public function move(Request $request, int $id)
    {
        $type = TypeDocument::findOrFail($id);

        $validatedData = $request->validate([
            'parent_id' => [
                'nullable',
                'integer',
                Rule::exists('type_documents', 'id')->where('categorie_id', $type->categorie_id),
            ],
        ]);

        $nouveauParentId = $validatedData['parent_id'] ?? null;

        if ($nouveauParentId === $type->id) {
            return response()->json(['error' => 'Un dossier ne peut pas être déplacé dans lui-même.'], 422);
        }

        // Empêche de déplacer un dossier à l'intérieur d'un de ses propres
        // sous-dossiers, ce qui casserait l'arborescence (boucle infinie).
        if ($nouveauParentId !== null) {
            $ancetre = TypeDocument::find($nouveauParentId);
            while ($ancetre !== null) {
                if ($ancetre->id === $type->id) {
                    return response()->json(['error' => "Un dossier ne peut pas être déplacé dans l'un de ses propres sous-dossiers."], 422);
                }
                $ancetre = $ancetre->parent_id ? TypeDocument::find($ancetre->parent_id) : null;
            }
        }

        if ($type->categorieDocument?->estVerrouille()) {
            return response()->json(['error' => 'Ce dossier est verrouillé — déverrouillez-le avant de le déplacer.'], 423);
        }

        $type->update(['parent_id' => $nouveauParentId]);
        return response()->json($type, 200);
    }

    public function destroy(int $id)
    {
        try {
            DB::beginTransaction();
            $type = TypeDocument::findOrFail($id);
            if ($type->categorieDocument?->estVerrouille()) {
                DB::rollback();
                return response()->json(['error' => 'Ce dossier est verrouillé — déverrouillez-le avant de supprimer ce sous-dossier.'], 423);
            }
            $type->delete();
            DB::commit();
            return response()->json(['message' => 'Type de document supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "La suppression a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    /**
     * Demande le téléchargement de tous les documents d'un sous-dossier : génère le
     * ZIP en tâche de fond et notifie l'utilisateur quand il est prêt.
     */
    public function download(Request $request, int $id, VisibiliteDocumentService $visibilite)
    {
        $type = TypeDocument::findOrFail($id);
        $nomPersonne = $request->query('nom_personne_concernee');

        $requeteDocs = DocumentArchive::where('type_document_id', $id);
        if ($nomPersonne) {
            $requeteDocs->where('nom_personne_concernee', $nomPersonne);
        }
        $visibilite->restreindre($requeteDocs, auth('api')->user());
        $nombreDocuments = $requeteDocs->count();

        if ($nombreDocuments === 0) {
            return response()->json(['error' => 'Ce dossier ne contient aucun document.'], 422);
        }

        $export = FolderExport::create([
            'utilisateur_id' => auth('api')->id(),
            'type_document_id' => $type->id,
            'nom_personne_concernee' => $nomPersonne,
            'nom_dossier' => $nomPersonne ? "{$type->libelle} — {$nomPersonne}" : $type->libelle,
            'statut' => 'en_attente',
        ]);

        GenererZipDossier::dispatch($export);

        return response()->json([
            'message' => "Préparation de l'archive en cours, vous serez notifié quand elle sera prête.",
            'export' => $export,
        ], 202);
    }
}
