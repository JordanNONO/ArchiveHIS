<?php

namespace App\Http\Controllers;

use App\Models\Category;
use Illuminate\Http\Request;
use App\Models\Document;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class DocumentController extends Controller
{
    public function index()
    {
        $docs = Document::with('user', 'category')->get(); // Inclure les relations User et Category
        return response()->json($docs, 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'category_id' => 'required|integer|exists:categories,id',
            'titre' => 'required|string|max:255',
            'auteur' => 'required|string|max:255',
            'resume' => 'required|string',
            'reference' => 'required|string|max:255',
            "file_create_date"=>'required|integer',
            'file' => 'nullable|file|mimes:pdf,doc,docx,ppt,pptx,csv,xls,xlsx|max:32048', // Adjust the file types and size as needed
        ]);

        // Ajoutez l'ID de l'utilisateur actuellement authentifié
        $validatedData['user_id'] = auth('api')->id();

        // Gérez le téléchargement de fichier si présent
        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $path = $file->store('documents'); // Stockez le fichier dans le répertoire storage/app/documents
            $validatedData['file_path'] = $path;
            $validatedData['type'] = $file->getMimeType();
            $validatedData['taille'] = $file->getSize();
            $validatedData['file_create_date'] = date('Y-m-d', strtotime(Date(DATE_ATOM,$validatedData['file_create_date'])));
            $validatedData['status_doc'] = 'disponible';
            $getCat = Category::find($validatedData['category_id']);
            Storage::disk("sftp")->makeDirectory($getCat['label']);
            Storage::disk('sftp')->putFileAs($getCat['label'],$request->file('file'),$validatedData['titre'].'.'.$file->extension());
            
        }

        try {
            DB::beginTransaction();
            // Créez un nouveau document
            $document = Document::create($validatedData);
            DB::commit();
            return response()->json(['message' => 'Document créé avec succès', 'document' => $document], 201);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur d'enregistrement: " . $th->getMessage()], 500);
        }
    }

    public function share(Request $request,Document $file)
    {
        $validated = $request->validate([
            "permissions"=>'required|string'
        ]);
        $user = auth('api')->user();
        $file->shares()->create([
            'user_id' => $user->id,
            'permissions' => $validated["permissions"], // or 'write'
        ]);
        
        return response()->json(['message' => 'File shared successfully.']);
    }

    public function favorite(Request $request, Document $file)
    {
        // Logic to add the file to the user's favorites
        $user = auth('api')->user();
        $user->favoriteFiles()->attach($file);

        return response()->json(['message' => 'File favorited successfully.']);
    }

    public function unfavorite(Request $request, Document $file)
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
        $document = Document::with('user', 'category')->findOrFail($doc_id); // Inclure les relations User et Category
        //$doc=Storage::disk("local")->get();
        
        return response()->file(storage_path("app/".$document['file_path']));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, int $doc_id)
    {
        $validatedData = $request->validate([
            'category_id' => 'required|integer|exists:categories,id',
            'titre' => 'required|string|max:255',
            'auteur' => 'required|string|max:255',
            'type' => 'required|string|max:255',
            'resume' => 'required|string',
            'reference' => 'required|string|max:255',
            'status_doc' => 'required|string|max:255',
            'file' => 'nullable|file|mimes:pdf,doc,docx|max:2048' // Adjust the file types and size as needed
        ]);

        try {
            $document = Document::findOrFail($doc_id);

            if ($request->hasFile('file')) {
                // Delete old file if exists
                if ($document->file_path) {
                    Storage::delete($document->file_path);
                }

                $file = $request->file('file');
                $filePath = $file->store('documents');
                $validatedData['file_path'] = $filePath;
            }

            $document->update($validatedData);

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
            $document = Document::findOrFail($doc_id);

            if ($document->file_path) {
                Storage::delete($document->file_path);
            }

            $document->delete();
            DB::commit();
            return response()->json(['message' => 'Document supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }
    public function countDoc(){
        try {
            // Récupérer tous les documents
            $documents = Document::all();
    
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
                $extension = strtolower(pathinfo($document->file_path, PATHINFO_EXTENSION));
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
