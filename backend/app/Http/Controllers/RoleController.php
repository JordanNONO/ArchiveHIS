<?php

namespace App\Http\Controllers;

use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $role = Role::all();
        return response()->json($role, 200);
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
            'label' => 'requirerequired',
            'acreditation' => 'required'

        ]);
        try {
            DB::beginTransaction();
            $role = Role::create($request->all());
            DB::commit();
            return response()->json($role, 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json('{"error":"Erreur d\'enregistrement "}' . $th, 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $code_role)
    {
        $role = Role::findOrFail($code_role);
        return response()->json($role, 200);
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
    public function update(Request $request, string $code_role)
    {
        try {
            $res = Role::find($code_role)->update($request->all());
            return response()->json($res, 200);
        } catch (\Throwable $th) {
            return response()->json($th, 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $code_role)
    {
        try {
            DB::beginTransaction();
            $role = Role::findOrFail($code_role);
            $role->delete();
            DB::commit();
            return response()->json(['message' => 'Bureau supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }
}
