<?php

namespace App\Http\Controllers;

use App\Models\Affectation;
use App\Models\Personnels;
use Illuminate\Support\Facades\Storage;

class AffectationController extends Controller
{
    /**
     * Les auxiliaires (intervenants) affectés au bénéficiaire connecté — sert
     * à proposer les bonnes personnes à noter (voir "Qualité de la prestation").
     */
    public function mesAuxiliaires()
    {
        $personnel = Personnels::where('utilisateur_id', auth('api')->id())->first();
        if (!$personnel) {
            return response()->json([], 200);
        }

        $idsIntervenants = Affectation::where('beneficiaire_personnel_id', $personnel->id)
            ->pluck('intervenant_personnel_id');

        $auxiliaires = Personnels::whereIn('id', $idsIntervenants)->get();

        return response()->json($auxiliaires->map(fn ($p) => [
            'id' => $p->id,
            'nom' => trim("{$p->prenom} {$p->nom}"),
            'photo' => $p->photo ? Storage::url($p->photo) : null,
        ]), 200);
    }
}
