<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\RoleUsers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $role = RoleUsers::with('permissions')->withCount('utilisateurs')->get();
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
            'nom' => 'required|string',
            'acreditation' => 'nullable|string',
            'code_role' => 'nullable|string|max:100',
        ]);
        try {
            DB::beginTransaction();
            $role = RoleUsers::create($validatedData);
            DB::commit();
            return response()->json($role, 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur d'enregistrement: " . $th->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $code_role)
    {
        $role = RoleUsers::with('permissions')->findOrFail($code_role);
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
        $validatedData = $request->validate([
            'nom' => 'required|string',
            'acreditation' => 'nullable|string',
            'code_role' => 'nullable|string|max:100',
        ]);

        try {
            $role = RoleUsers::findOrFail($code_role);
            $role->update($validatedData);
            return response()->json($role, 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => $th->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $code_role)
    {
        try {
            DB::beginTransaction();
            $role = RoleUsers::findOrFail($code_role);
            $role->delete();
            DB::commit();
            return response()->json(['message' => 'Rôle supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }

    /**
     * Remplace l'ensemble des permissions attachées au rôle.
     */
    public function attachPermissions(Request $request, RoleUsers $role)
    {
        $validated = $request->validate([
            'permission_ids' => 'required|array',
            'permission_ids.*' => 'integer|exists:permissions,id',
        ]);

        $role->permissions()->sync($validated['permission_ids']);

        return response()->json($role->load('permissions'), 200);
    }

    /**
     * Détache une permission précise du rôle.
     */
    public function detachPermission(RoleUsers $role, Permission $permission)
    {
        $role->permissions()->detach($permission->id);

        return response()->json($role->load('permissions'), 200);
    }
}
