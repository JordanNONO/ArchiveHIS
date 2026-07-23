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
        $validatedData = $request->validate([
            'user_id'=>'required|exists:users,id',
            'document_id'=>'required|exists:documents,id',
        ]);
        try {
            DB::beginTransaction();
            $consultation = Consultation::create($request->all());
            DB::commit();
            return response()->json($consultation, 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json('{"error":"Erreur d\'enregistrement "}' . $th, 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $code_pers, $doc_id)
    {
        $consultation = Consultation::findOrFail($code_pers, $doc_id);
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
            $res = Consultation::find($code_pers, $doc_id)->update($request->all());
            return response()->json($res, 200);
        } catch (\Throwable $th) {
            return response()->json($th, 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $code_pers, $doc_id)
    {
        try {
            DB::beginTransaction();
            $consultation = Consultation::findOrFail($code_pers, $doc_id);
            $consultation->delete();
            DB::commit();
            return response()->json(['message' => 'Bureau supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }
}
