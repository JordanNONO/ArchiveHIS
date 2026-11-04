<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Annonce à la paie : note officielle adressée au cabinet de paie avec son
 * justificatif, rattachée au mois de fluctuation (voir la migration
 * creer_annonces_paie_table). La fluctuation dit ce qui se paie ce mois-ci,
 * l'annonce dit ce qui change dans le dossier du salarié.
 *
 * Le circuit d'une annonce est indépendant de celui du mois : une annonce
 * peut être transmise puis lue alors que le mois est encore en brouillon.
 */
class AnnoncePaie extends Model
{
    use HasFactory;

    protected $table = 'annonces_paie';

    /**
     * Types d'annonce. Chacun décide des champs "ancienne / nouvelle valeur"
     * demandés à la saisie (un RIB a en plus sa banque) — voir CHAMPS.
     */
    public const TYPE_RIB = 'rib';
    public const TYPE_ADRESSE = 'adresse';
    public const TYPE_SITUATION_FAMILIALE = 'situation_familiale';
    public const TYPE_MUTUELLE = 'mutuelle';
    public const TYPE_INFO = 'info';

    public const TYPES = [self::TYPE_RIB, self::TYPE_ADRESSE, self::TYPE_SITUATION_FAMILIALE, self::TYPE_MUTUELLE, self::TYPE_INFO];

    /**
     * Clés attendues dans `donnees` selon le type. L'ordre est celui de la
     * saisie et de l'affichage de la fiche. Le type "info" n'a pas de couple
     * ancienne/nouvelle valeur : tout tient dans le message.
     */
    public const CHAMPS = [
        self::TYPE_RIB => ['ancienne', 'nouvelle', 'banque'],
        self::TYPE_ADRESSE => ['ancienne', 'nouvelle'],
        self::TYPE_SITUATION_FAMILIALE => ['ancienne', 'nouvelle'],
        self::TYPE_MUTUELLE => ['ancienne', 'nouvelle'],
        self::TYPE_INFO => [],
    ];

    /** Un justificatif est attendu pour ces types : ils modifient le dossier de paie. */
    public const TYPES_JUSTIFICATIF_ATTENDU = [self::TYPE_RIB, self::TYPE_ADRESSE, self::TYPE_SITUATION_FAMILIALE, self::TYPE_MUTUELLE];

    public const STATUT_BROUILLON = 'brouillon';
    public const STATUT_A_TRANSMETTRE = 'a_transmettre';
    public const STATUT_TRANSMIS = 'transmis';
    public const STATUT_LU = 'lu';

    public const STATUTS = [self::STATUT_BROUILLON, self::STATUT_A_TRANSMETTRE, self::STATUT_TRANSMIS, self::STATUT_LU];

    protected $fillable = [
        'mois',
        'type',
        'salarie',
        'date_effet',
        'donnees',
        'message',
        'piece_jointe',
        'piece_jointe_nom',
        'statut',
        'inclure_export',
        'transmis_le',
        'transmis_par_id',
        'lu_le',
        'utilisateur_id',
        'modifie_par_id',
    ];

    protected $casts = [
        'mois' => 'date:Y-m-d',
        'date_effet' => 'date:Y-m-d',
        // IBAN, situations familiales : chiffrés au repos, comme protocole
        // et donnees_hissap ailleurs.
        'donnees' => 'encrypted:array',
        'inclure_export' => 'boolean',
        'transmis_le' => 'datetime',
        'lu_le' => 'datetime',
    ];

    protected $appends = ['piece_manquante'];

    /**
     * Une annonce qui change le dossier de paie sans justificatif joint :
     * c'est ce que la page signale avant de valider le mois.
     */
    public function getPieceManquanteAttribute(): bool
    {
        return in_array($this->type, self::TYPES_JUSTIFICATIF_ATTENDU, true) && !$this->piece_jointe;
    }

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function transmisPar(): BelongsTo
    {
        return $this->belongsTo(Utilisateurs::class, 'transmis_par_id');
    }

    public function modifiePar(): BelongsTo
    {
        return $this->belongsTo(Utilisateurs::class, 'modifie_par_id');
    }
}
