<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Lien "qui intervient chez qui" — voir la migration create_affectations_table
 * pour le contexte (destinée à une future synchronisation externe).
 */
class Affectation extends Model
{
    protected $fillable = [
        'intervenant_personnel_id',
        'beneficiaire_personnel_id',
    ];

    public function intervenant()
    {
        return $this->belongsTo(Personnels::class, 'intervenant_personnel_id');
    }

    public function beneficiaire()
    {
        return $this->belongsTo(Personnels::class, 'beneficiaire_personnel_id');
    }
}
