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
        'personnels_concernes_ids',
        'service_metier_concerne_id',
        'personne_concernee_texte',
        'action',
        'traite_le',
        'traite_par_id',
        'note_traitement',
    ];

    protected $casts = [
        'date_appel' => 'date',
        'traite_le' => 'datetime',
        'personnels_concernes_ids' => 'array',
    ];

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function personnelConcerne()
    {
        return $this->belongsTo(Personnels::class, 'personnel_concerne_id');
    }

    public function serviceMetierConcerne()
    {
        return $this->belongsTo(ServiceMetier::class, 'service_metier_concerne_id');
    }

    /**
     * Pas une vraie relation Eloquent (personnels_concernes_ids est un JSON,
     * pas une table pivot) — juste un raccourci pratique pour le mode
     * "plusieurs personnes" (voir AppelTelephoniqueController).
     */
    public function personnelsConcernes()
    {
        return Personnels::with('user')->whereIn('id', $this->personnels_concernes_ids ?? [])->get();
    }

    public function traitePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'traite_par_id');
    }
}
