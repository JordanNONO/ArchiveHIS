<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Contenu de formation interne (vidéo + PDF) — singleton, voir FormationController.
 */
class Formation extends Model
{
    protected $fillable = [
        'titre',
        'description',
        'video_chemin',
        'video_nom_original',
        'video_mime',
        'pdf_chemin',
        'pdf_nom_original',
        'mis_a_jour_par',
    ];

    public function misAJourPar()
    {
        return $this->belongsTo(Utilisateurs::class, 'mis_a_jour_par');
    }
}
