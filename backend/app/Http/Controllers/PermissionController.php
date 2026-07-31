<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PermissionController extends Controller
{
    public function index()
    {
        return response()->json(Permission::all(), 200);
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'code_perm' => 'required|string|max:100|unique:permissions,code_perm',
            'label_perm' => 'required|string|max:255',
        ]);

        try {
            DB::beginTransaction();
            $permission = Permission::create($validatedData);
            DB::commit();
            return response()->json($permission, 201);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "L'enregistrement a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    public function show(int $permission)
    {
        return response()->json(Permission::findOrFail($permission), 200);
    }

    public function update(Request $request, int $permission)
    {
        $model = Permission::findOrFail($permission);

        $validatedData = $request->validate([
            'code_perm' => ['required', 'string', 'max:100', Rule::unique('permissions', 'code_perm')->ignore($model->id)],
            'label_perm' => 'required|string|max:255',
        ]);

        try {
            $model->update($validatedData);
            return response()->json($model, 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "La mise à jour a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    public function destroy(int $permission)
    {
        try {
            DB::beginTransaction();
            $model = Permission::findOrFail($permission);
            $model->delete();
            DB::commit();
            return response()->json(['message' => 'Permission supprimée avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "La suppression a échoué. Réessayez dans quelques instants."], 500);
        }
    }
}
