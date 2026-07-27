<?php

namespace App\Http\Controllers;

use App\Models\ServiceMetier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ServiceMetierController extends Controller
{
    public function index()
    {
        return response()->json(ServiceMetier::withCount('roles')->get(), 200);
    }

    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'code_service' => 'required|string|max:100|unique:services_metier,code_service',
            'nom_service' => 'required|string|max:255',
        ]);

        try {
            DB::beginTransaction();
            $service = ServiceMetier::create($validatedData);
            DB::commit();
            return response()->json($service, 201);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur d'enregistrement: " . $th->getMessage()], 500);
        }
    }

    public function show(int $service)
    {
        return response()->json(ServiceMetier::findOrFail($service), 200);
    }

    public function update(Request $request, int $service)
    {
        $model = ServiceMetier::findOrFail($service);

        $validatedData = $request->validate([
            'code_service' => ['required', 'string', 'max:100', Rule::unique('services_metier', 'code_service')->ignore($model->id)],
            'nom_service' => 'required|string|max:255',
        ]);

        try {
            $model->update($validatedData);
            return response()->json($model, 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => "Erreur de mise à jour: " . $th->getMessage()], 500);
        }
    }

    public function destroy(int $service)
    {
        try {
            DB::beginTransaction();
            $model = ServiceMetier::findOrFail($service);
            $model->delete();
            DB::commit();
            return response()->json(['message' => 'Service métier supprimé avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }

    public function archives(int $service)
    {
        $model = ServiceMetier::findOrFail($service);
        return response()->json($model->consulterArchives(), 200);
    }
}
