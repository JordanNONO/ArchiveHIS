<?php

namespace App\Http\Controllers;

use App\Models\Cheque;
use Illuminate\Http\Request;

/**
 * Registre des chèques reçus — table dédiée (voir Cheque), même charpente
 * que AppelTelephoniqueController. Accès réservé à la Comptabilité +
 * Administrateur (permission gerer_cheques, voir routes/api.php) — même
 * périmètre que traiter_courrier, un chèque reçu est une affaire financière.
 */
class ChequeController extends Controller
{
    /**
     * Liste complète — sert au registre et à l'autocomplétion (banque,
     * émetteur...) côté formulaire, même principe que
     * AppelTelephoniqueController::index().
     */
    public function index()
    {
        $cheques = Cheque::with(['utilisateur.personnels', 'traitePar'])
            ->orderByDesc('date_emission')
            ->orderByDesc('id')
            ->get();

        return response()->json($cheques, 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'numero_bordereau_remise' => 'nullable|string|max:255',
            'date_depot' => 'nullable|date',
            'banque_depot' => 'nullable|string|max:255',
            'date_emission' => 'required|date',
            'numero_cheque' => 'required|string|max:100',
            'banque_emettrice' => 'nullable|string|max:255',
            'nom_emetteur' => 'required|string|max:255',
            'nom_beneficiaire' => 'nullable|string|max:255',
            'montant' => 'required|numeric|min:0',
            'facture_reglee' => 'nullable|string|max:255',
        ]);

        $validated['utilisateur_id'] = auth('api')->id();

        $cheque = Cheque::create($validated);
        $cheque->load('utilisateur.personnels');

        return response()->json($cheque, 201);
    }

    public function update(Request $request, Cheque $cheque)
    {
        $validated = $request->validate([
            'numero_bordereau_remise' => 'nullable|string|max:255',
            'date_depot' => 'nullable|date',
            'banque_depot' => 'nullable|string|max:255',
            'date_emission' => 'required|date',
            'numero_cheque' => 'required|string|max:100',
            'banque_emettrice' => 'nullable|string|max:255',
            'nom_emetteur' => 'required|string|max:255',
            'nom_beneficiaire' => 'nullable|string|max:255',
            'montant' => 'required|numeric|min:0',
            'facture_reglee' => 'nullable|string|max:255',
        ]);

        $cheque->update($validated);
        $cheque->load('utilisateur.personnels');

        return response()->json($cheque, 200);
    }

    public function destroy(Cheque $cheque)
    {
        $cheque->delete();

        return response()->json(['message' => 'Chèque supprimé avec succès'], 200);
    }

    /**
     * Marque le chèque traité (vérifié/rapproché) — avec une note libre
     * optionnelle, même principe que
     * AppelTelephoniqueController::marquerTraite().
     */
    public function marquerTraite(Request $request, Cheque $cheque)
    {
        $validated = $request->validate([
            'note_traitement' => 'nullable|string|max:2000',
        ]);

        $cheque->update([
            'traite_le' => now(),
            'traite_par_id' => auth('api')->id(),
            'note_traitement' => $validated['note_traitement'] ?? null,
        ]);
        $cheque->load(['utilisateur.personnels', 'traitePar']);

        return response()->json($cheque, 200);
    }

    /**
     * Pour la tuile "Chèques à traiter" du tableau de bord (voir Home.jsx),
     * même principe que AppelTelephoniqueController::compteurs().
     */
    public function compteurs()
    {
        return response()->json([
            'a_traiter' => Cheque::whereNull('traite_le')->count(),
        ], 200);
    }
}
