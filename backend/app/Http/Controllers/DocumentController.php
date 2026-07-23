<?php

namespace App\Http\Controllers;

use App\Enums\StatutDocument;
use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\HistoriqueStatut;
use App\Services\DocumentStatusService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;

class DocumentController extends Controller
{
    public function index()
    {
        $docs = DocumentArchive::with('utilisateur', 'categorieDocument')->get();
        return response()->json($docs, 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'category_id' => 'required|integer|exists:categorie_documents,id',
            'titre' => 'required|string|max:255',
            'auteur' => 'required|string|max:255',
            'resume' => 'required|string',
            'reference' => 'required|string|max:255',
            'file_create_date' => 'required|integer',
            'duree_conservation_annees' => 'nullable|integer|min:1|max:99',
            'niveau_confidentialite' => 'nullable|string|in:PUBLIC,INTERNE,CONFIDENTIEL,STRICTEMENT_CONFIDENTIEL',
            'file' => 'nullable|file|mimes:pdf,doc,docx,ppt,pptx,csv,xls,xlsx|max:32048',
        ]);

        $data = [
            'utilisateur_id' => auth('api')->id(),
            'categorie_id' => $validatedData['category_id'],
            'titre_document' => $validatedData['titre'],
            'auteur' => $validatedData['auteur'],
            'resume' => $validatedData['resume'],
            'code_reference' => $validatedData['reference'],
            'duree_conservation_annees' => $validatedData['duree_conservation_annees'] ?? 5,
            'niveau_confidentialite' => $validatedData['niveau_confidentialite'] ?? 'INTERNE',
            'status_doc' => StatutDocument::BROUILLON->value,
        ];

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $categorie = CategorieDocument::find($data['categorie_id']);
            $contenu = file_get_contents($file->getRealPath());
            $nomFichier = $data['titre_document'] . '.' . $file->extension();
            $chemin = $categorie['libelle_cat'] . '/' . $nomFichier;

            Storage::disk('sftp')->makeDirectory($categorie['libelle_cat']);
            Storage::disk('sftp')->put($chemin, $contenu);

            $data['nom_fichier_original'] = $file->getClientOriginalName();
            $data['chemin_stockage_serveur'] = $chemin;
            $data['format_mime'] = $file->getMimeType();
            $data['taille'] = $file->getSize();
            $data['checksum_sha256'] = hash('sha256', $contenu);
            $data['file_create_date'] = date('Y-m-d', strtotime(date(DATE_ATOM, $validatedData['file_create_date'])));
        }

        try {
            DB::beginTransaction();
            $document = DocumentArchive::create($data);

            HistoriqueStatut::create([
                'document_archive_id' => $document->id,
                'ancien_statut' => null,
                'nouveau_statut' => StatutDocument::BROUILLON->value,
                'date_changement' => now(),
                'motif_changement' => 'Création du document',
            ]);

            DB::commit();
            return response()->json(['message' => 'Document créé avec succès', 'document' => $document], 201);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur d'enregistrement: " . $th->getMessage()], 500);
        }
    }

    public function share(Request $request, DocumentArchive $file)
    {
        $validated = $request->validate([
            "permissions" => 'required|string'
        ]);
        $user = auth('api')->user();
        $file->shares()->create([
            'utilisateur_id' => $user->id,
            'permissions' => $validated["permissions"], // or 'write'
        ]);

        return response()->json(['message' => 'File shared successfully.']);
    }

    public function favorite(Request $request, DocumentArchive $file)
    {
        // Logic to add the file to the user's favorites
        $user = auth('api')->user();
        $user->favoriteFiles()->attach($file);

        return response()->json(['message' => 'File favorited successfully.']);
    }

    public function unfavorite(Request $request, DocumentArchive $file)
    {
        // Logic to remove the file from the user's favorites
        $user = auth('api')->user();
        $user->favoriteFiles()->detach($file);

        return response()->json(['message' => 'File unfavorited successfully.']);
    }

    /**
     * Display the specified resource.
     */
    public function show(int $doc_id)
    {
        $document = DocumentArchive::with('utilisateur', 'categorieDocument')->findOrFail($doc_id);

        return response(Storage::disk('sftp')->get($document->chemin_stockage_serveur))
            ->header('Content-Type', $document->format_mime ?? 'application/octet-stream');
    }

    /**
     * Métadonnées JSON du document (titre, statut, catégorie...), sans le contenu du fichier.
     */
    public function meta(DocumentArchive $document)
    {
        return response()->json($document->load('utilisateur', 'categorieDocument'), 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, int $doc_id)
    {
        $validatedData = $request->validate([
            'category_id' => 'required|integer|exists:categorie_documents,id',
            'titre' => 'required|string|max:255',
            'auteur' => 'required|string|max:255',
            'resume' => 'required|string',
            'reference' => 'required|string|max:255',
        ]);

        try {
            $document = DocumentArchive::findOrFail($doc_id);

            $document->update([
                'categorie_id' => $validatedData['category_id'],
                'titre_document' => $validatedData['titre'],
                'auteur' => $validatedData['auteur'],
                'resume' => $validatedData['resume'],
                'code_reference' => $validatedData['reference'],
            ]);

            return response()->json($document, 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => 'Erreur de mise à jour: ' . $th->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $doc_id)
    {
        try {
            DB::beginTransaction();
            $document = DocumentArchive::findOrFail($doc_id);

            if ($document->chemin_stockage_serveur) {
                Storage::disk('sftp')->delete($document->chemin_stockage_serveur);
            }

            $document->delete();
            DB::commit();
            return response()->json(['message' => 'Document supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }

    /**
     * Fait transitionner le document vers un nouveau statut du workflow.
     */
    public function transition(Request $request, DocumentArchive $document, DocumentStatusService $service)
    {
        $validated = $request->validate([
            'nouveau_statut' => 'required|string',
            'motif' => 'nullable|string',
        ]);

        try {
            $document = $service->transitionTo($document, $validated['nouveau_statut'], $validated['motif'] ?? null);
            return response()->json($document, 200);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Historique des changements de statut du document.
     */
    public function historique(DocumentArchive $document)
    {
        return response()->json($document->historiqueStatuts, 200);
    }

    /**
     * Vérifie l'intégrité du fichier archivé (checksum SHA-256).
     */
    public function verifierIntegrite(DocumentArchive $document)
    {
        return response()->json(['integre' => $document->verifierIntegrite()], 200);
    }

    public function countDoc()
    {
        try {
            // Récupérer tous les documents
            $documents = DocumentArchive::all();

            // Initialiser un tableau pour les comptages par extension
            $counts = [
                'pdf' => 0,
                'doc' => 0,
                'docx' => 0,
                'xls' => 0,
                'xlsx' => 0,
                'csv' => 0,
                'ppt' => 0,
                'pptx' => 0,
                'others' => 0
            ];

            // Parcourir les documents et compter les extensions
            foreach ($documents as $document) {
                $extension = strtolower(pathinfo($document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION));
                if (array_key_exists($extension, $counts)) {
                    $counts[$extension]++;
                } else {
                    $counts['others']++;
                }
            }

            return response()->json([
                'documents' => $documents,
                'counts' => $counts
            ], 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => "Erreur de récupération: " . $th->getMessage()], 500);
        }
    }
}
