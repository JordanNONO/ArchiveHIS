<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Réglage d'application en clé/valeur (voir la migration
 * creer_parametres_application_table). La valeur est un objet JSON : un
 * réglage a rarement un seul champ, et le découper en plusieurs lignes
 * obligerait à les relire une par une.
 */
class ParametreApplication extends Model
{
    use HasFactory;

    protected $table = 'parametres_application';

    /** Habillage saisonnier du logo — voir ParametreApplicationController. */
    public const CLE_HABILLAGE_SAISONNIER = 'habillage_saisonnier';

    protected $fillable = ['cle', 'valeur', 'modifie_par_id'];

    protected $casts = ['valeur' => 'array'];

    /** Valeur enregistrée, ou le défaut quand le réglage n'a jamais été touché. */
    public static function lire(string $cle, array $defaut = []): array
    {
        $parametre = static::where('cle', $cle)->first();

        return array_merge($defaut, $parametre?->valeur ?? []);
    }

    public static function ecrire(string $cle, array $valeur, ?int $utilisateurId = null): array
    {
        $parametre = static::updateOrCreate(
            ['cle' => $cle],
            ['valeur' => $valeur, 'modifie_par_id' => $utilisateurId]
        );

        return $parametre->valeur;
    }
}
