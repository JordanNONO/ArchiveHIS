<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Circuit de validation d'un mois de fluctuation RH : brouillon -> validé
 * (RH) -> transmis (paie). Absent en base = brouillon (créé à la première
 * transition, pas à la première ligne saisie).
 */
class FluctuationRhMois extends Model
{
    protected $table = 'fluctuations_rh_mois';

    public const BROUILLON = 'brouillon';
    public const VALIDE = 'valide';
    public const TRANSMIS = 'transmis';

    protected $fillable = [
        'mois',
        'statut',
        'valide_le',
        'valide_par_id',
        'transmis_le',
        'transmis_par_id',
    ];

    protected $casts = [
        'mois' => 'date:Y-m-d',
        'valide_le' => 'datetime',
        'transmis_le' => 'datetime',
    ];

    public function validePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'valide_par_id');
    }

    public function transmisPar()
    {
        return $this->belongsTo(Utilisateurs::class, 'transmis_par_id');
    }

    public static function estVerrouille(string $mois): bool
    {
        $statut = static::where('mois', $mois)->value('statut');
        return $statut !== null && $statut !== self::BROUILLON;
    }
}
