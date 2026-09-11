<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Une ligne du registre des appels téléphoniques — voir la migration
 * create_appels_telephoniques_table pour le contexte (table dédiée, pas un
 * document).
 */
class AppelTelephonique extends Model
{
    use HasFactory;

    protected $table = 'appels_telephoniques';

    protected $fillable = [
        'date_appel',
        'heure_appel',
        'utilisateur_id',
        'appelant_nom',
        'appelant_telephone',
        'appelant_organisation',
        'appelant_qualite',
        'appelant_email',
        'objet',
        'message',
        'oriente_nom',
        'oriente_service',
        'personnel_concerne_id',
        'personne_concernee_texte',
        'action',
        'traite_le',
        'traite_par_id',
    ];

    protected $casts = [
        'date_appel' => 'date',
        'traite_le' => 'datetime',
    ];

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function personnelConcerne()
    {
        return $this->belongsTo(Personnels::class, 'personnel_concerne_id');
    }

    public function traitePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'traite_par_id');
    }
}
