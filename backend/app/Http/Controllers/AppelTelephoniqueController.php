<?php

namespace App\Http\Controllers;

use App\Models\AppelTelephonique;
use Illuminate\Http\Request;

/**
 * Registre des appels téléphoniques — table dédiée (voir AppelTelephonique),
 * complètement indépendante des documents/courriers. Accès réservé au
 * personnel du service Administratif + Administrateur (permission
 * gerer_appels, voir routes/api.php).
 */
class AppelTelephoniqueController extends Controller
{
    /**
     * Liste complète — sert à la fois au registre et à l'autocomplétion sur
     * le nom de l'appelant côté formulaire (même principe que Courriers.jsx
     * qui réutilise sa propre liste de documents pour tout).
     */
    public function index()
    {
        $appels = AppelTelephonique::with(['utilisateur.personnels', 'personnelConcerne', 'traitePar'])
            ->orderByDesc('date_appel')
            ->orderByDesc('heure_appel')
            ->get();

        return response()->json($appels, 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'date_appel' => 'required|date',
            'heure_appel' => 'required|date_format:H:i',
            'appelant_nom' => 'required|string|max:255',
            'appelant_telephone' => 'required|string|max:50',
            'appelant_organisation' => 'nullable|string|max:255',
            'appelant_qualite' => 'nullable|string|max:255',
            'appelant_email' => 'nullable|string|max:255',
            'objet' => 'nullable|string|max:255',
            'message' => 'nullable|string',
            'oriente_nom' => 'nullable|string|max:255',
            'oriente_service' => 'nullable|string|max:255',
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'personne_concernee_texte' => 'nullable|string|max:255',
            'action' => 'required|string|in:Rappeler,Rappeler URGENT,Rappellera,Pour info',
        ]);

        $validated['utilisateur_id'] = auth('api')->id();

        $appel = AppelTelephonique::create($validated);
        $appel->load(['utilisateur.personnels', 'personnelConcerne']);

        return response()->json($appel, 201);
    }

    public function update(Request $request, AppelTelephonique $appel)
    {
        $validated = $request->validate([
            'date_appel' => 'required|date',
            'heure_appel' => 'required|date_format:H:i',
            'appelant_nom' => 'required|string|max:255',
            'appelant_telephone' => 'required|string|max:50',
            'appelant_organisation' => 'nullable|string|max:255',
            'appelant_qualite' => 'nullable|string|max:255',
            'appelant_email' => 'nullable|string|max:255',
            'objet' => 'nullable|string|max:255',
            'message' => 'nullable|string',
            'oriente_nom' => 'nullable|string|max:255',
            'oriente_service' => 'nullable|string|max:255',
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'personne_concernee_texte' => 'nullable|string|max:255',
            'action' => 'required|string|in:Rappeler,Rappeler URGENT,Rappellera,Pour info',
        ]);

        $appel->update($validated);
        $appel->load(['utilisateur.personnels', 'personnelConcerne']);

        return response()->json($appel, 200);
    }

    public function marquerTraite(AppelTelephonique $appel)
    {
        $appel->update([
            'traite_le' => now(),
            'traite_par_id' => auth('api')->id(),
        ]);
        $appel->load(['utilisateur.personnels', 'personnelConcerne', 'traitePar']);

        return response()->json($appel, 200);
    }

    /**
     * Pour la tuile "Appels à traiter" du tableau de bord (voir Home.jsx),
     * même principe que DocumentController::courrierCompteurs().
     */
    public function compteurs()
    {
        return response()->json([
            'a_traiter' => AppelTelephonique::whereNull('traite_le')->count(),
        ], 200);
    }
}
