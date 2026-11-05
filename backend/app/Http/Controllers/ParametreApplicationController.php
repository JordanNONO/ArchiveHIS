<?php

namespace App\Http\Controllers;

use App\Models\ParametreApplication;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Habillage saisonnier du logo (toile d'araignée fin octobre, guirlande de
 * Noël en décembre) — voir LogoSaisonnier.jsx et utils/saisons.js.
 *
 * Deux droits distincts, volontairement :
 *
 * - LIRE est ouvert à tout compte connecté : le logo est le même pour tout
 *   le monde, chaque navigateur doit donc savoir s'il l'habille ou non ;
 * - ÉCRIRE est réservé au Super Administrateur. Masquer le réglage dans
 *   l'interface ne suffit pas — un bouton caché n'est pas une sécurité, et
 *   la route refuse ici quiconque appelle l'API directement.
 */
class ParametreApplicationController extends Controller
{
    /** Réglage par défaut tant que personne n'y a touché : habillage actif. */
    private const DEFAUT = [
        'actif' => true,
        // null = on suit le calendrier ; 'halloween' ou 'noel' = on force
        // l'affichage hors période, pour voir le rendu.
        'forcer' => null,
    ];

    public function habillageSaisonnier()
    {
        return response()->json(
            ParametreApplication::lire(ParametreApplication::CLE_HABILLAGE_SAISONNIER, self::DEFAUT),
            200
        );
    }

    public function majHabillageSaisonnier(Request $request)
    {
        $utilisateur = auth('api')->user();

        if (!$utilisateur?->estSuperAdministrateur()) {
            return response()->json(['error' => "Ce réglage est réservé au Super Administrateur."], 403);
        }

        $valide = $request->validate([
            'actif' => 'required|boolean',
            'forcer' => ['nullable', Rule::in(['halloween', 'noel'])],
        ]);

        $enregistre = ParametreApplication::ecrire(
            ParametreApplication::CLE_HABILLAGE_SAISONNIER,
            ['actif' => $valide['actif'], 'forcer' => $valide['forcer'] ?? null],
            $utilisateur->id
        );

        return response()->json($enregistre, 200);
    }
}
