<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\RoleUsers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoleController extends Controller
{
    /**
     * Ces 4 noms sont lus en dur par Utilisateurs::estAdministrateur()/
     * estViewer()/estCompteDepot() — renommer ou supprimer l'un de ces rôles
     * casserait silencieusement ces vérifications pour tout le monde (perte
     * de droits, pas d'erreur visible). Même principe que
     * UTILISATEUR_ID_ADMIN_PROTEGE dans PersonnelController, appliqué ici au
     * rôle plutôt qu'au compte.
     */
    private const NOMS_ROLES_PROTEGES = ['Administrator', 'Viewer', 'Intervenant', 'Beneficiaire'];

    private function bloquerSiRoleProtege(RoleUsers $role): ?\Illuminate\Http\JsonResponse
    {
        if (in_array($role->nom, self::NOMS_ROLES_PROTEGES, true)) {
            return response()->json(['error' => "Ce rôle est utilisé directement par le code de l'application et ne peut pas être renommé ou supprimé."], 403);
        }
        return null;
    }

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
            report($th);
            return response()->json(['error' => "L'enregistrement a échoué. Réessayez dans quelques instants."], 500);
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
            if ($reponse = $this->bloquerSiRoleProtege($role)) {
                return $reponse;
            }
            $role->update($validatedData);
            return response()->json($role, 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "La mise à jour a échoué. Réessayez dans quelques instants."], 500);
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
            if ($reponse = $this->bloquerSiRoleProtege($role)) {
                DB::rollBack();
                return $reponse;
            }
            $role->delete();
            DB::commit();
            return response()->json(['message' => 'Rôle supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "La suppression a échoué. Réessayez dans quelques instants."], 500);
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
