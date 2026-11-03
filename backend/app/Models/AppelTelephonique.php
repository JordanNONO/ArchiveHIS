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
        'groupe_concerne',
        'personne_concernee_texte',
        'action',
        'traite_le',
        'traite_par_id',
        'note_traitement',
        'rappel_appel_envoye_le',
    ];

    /**
     * Groupes de personnes qu'on peut désigner comme "concernés" à côté des
     * services métier. Les Responsables Secteur n'appartiennent à aucun
     * service (rôle transverse, service_metier_id NULL) : sans ce groupe, on
     * ne pouvait pas adresser un appel à eux seuls. Ils ont un rôle générique
     * (RS) et des variantes spécialisées (RS_QUALITE, RS_EXPLOITATION,
     * RS_COORDINATION, voir creer_roles_specialises_responsable_secteur).
     */
    public const GROUPE_RESPONSABLES_SECTEUR = 'responsables_secteur';

    public const GROUPES = [self::GROUPE_RESPONSABLES_SECTEUR];

    /** Contrainte sur une requête de rôles : ceux qui composent le groupe. */
    public static function filtrerRolesDuGroupe($query, string $groupe): void
    {
        if ($groupe === self::GROUPE_RESPONSABLES_SECTEUR) {
            $query->where(fn ($q) => $q->where('code_role', 'RS')->orWhere('code_role', 'like', 'RS\_%'));
            return;
        }

        $query->whereRaw('1 = 0');
    }

    protected $casts = [
        'date_appel' => 'date',
        'traite_le' => 'datetime',
        'personnels_concernes_ids' => 'array',
        'rappel_appel_envoye_le' => 'datetime',
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
