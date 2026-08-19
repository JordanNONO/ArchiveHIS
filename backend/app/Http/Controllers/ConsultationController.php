<?php

namespace App\Http\Controllers;

use App\Models\Consultation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
class ConsultationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $consultation = Consultation::all();
        return response()->json($consultation, 200);
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
        // L'utilisateur qui consulte est toujours celui de la session — on ne fait
        // jamais confiance à un user_id fourni par le client, qui permettrait à
        // n'importe quel compte de fabriquer une fausse consultation au nom d'un
        // autre utilisateur.
        $validatedData = $request->validate([
            'document_id' => 'required|exists:document_archives,id',
        ]);
        try {
            DB::beginTransaction();
            // updateOrCreate, pas create() : la contrainte d'unicité
            // (utilisateur_id, document_id) fait qu'ouvrir un document déjà
            // consulté plantait en 500 au lieu de simplement rafraîchir la
            // date de dernière consultation.
            $consultation = Consultation::updateOrCreate(
                ['utilisateur_id' => auth('api')->id(), 'document_id' => $validatedData['document_id']],
                []
            );
            DB::commit();
            return response()->json($consultation, 200);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "L'enregistrement a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $code_pers, $doc_id)
    {
        $consultation = Consultation::where('utilisateur_id', $code_pers)->where('document_id', $doc_id)->firstOrFail();
        return response()->json($consultation, 200);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $code_pers, $doc_id)
    {
        try {
            $consultation = Consultation::where('utilisateur_id', $code_pers)->where('document_id', $doc_id)->firstOrFail();
            $consultation->update($request->all());
            return response()->json($consultation, 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "La mise à jour a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $code_pers, $doc_id)
    {
        try {
            DB::beginTransaction();
            $consultation = Consultation::where('utilisateur_id', $code_pers)->where('document_id', $doc_id)->firstOrFail();
            $consultation->delete();
            DB::commit();
            return response()->json(['message' => 'Consultation supprimée avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "La suppression a échoué. Réessayez dans quelques instants."], 500);
        }
    }
}
