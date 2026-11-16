<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use InvalidArgumentException;

/**
 * Une période de détention, portant sur UN SEUL objet : ce téléphone, ou ce
 * numéro. Voir la migration pour pourquoi les deux ne cohabitent pas dans la
 * même ligne.
 */
class TelephonieDetention extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'telephonie_detentions';

    public const ETATS_MATERIEL = ['neuf', 'bon', 'usage', 'casse'];

    /**
     * Un transfert n'est pas une restitution : le téléphone n'est jamais
     * repassé par le stock, et une ligne reprise pour quelqu'un d'autre n'a
     * pas été « rendue ». Les confondre fausse la lecture du parc.
     */
    public const MOTIFS_FIN = ['restitution', 'transfert', 'incident', 'fin_contrat'];

    protected $fillable = [
        'personnel_id',
        'salarie_nom',
        'appareil_id',
        'ligne_id',
        'remise_id',
        'date_debut',
        'etat_debut',
        'date_fin',
        'etat_fin',
        'motif_fin',
        'observations',
        'cree_par_id',
    ];

    protected $casts = [
        'date_debut' => 'date',
        'date_fin' => 'date',
    ];

    public function personnel()
    {
        return $this->belongsTo(Personnels::class, 'personnel_id');
    }

    public function appareil()
    {
        return $this->belongsTo(TelephonieAppareil::class, 'appareil_id');
    }

    public function ligne()
    {
        return $this->belongsTo(TelephonieLigne::class, 'ligne_id');
    }

    public function remise()
    {
        return $this->belongsTo(TelephonieRemise::class, 'remise_id');
    }

    public function creePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'cree_par_id');
    }

    /** Ce qui est encore détenu aujourd'hui. */
    public function scopeEnCours($query)
    {
        return $query->whereNull('date_fin');
    }

    public function estEnCours(): bool
    {
        return $this->date_fin === null;
    }

    /** 'appareil' ou 'ligne' — jamais les deux, jamais aucun. */
    public function objet(): string
    {
        return $this->appareil_id ? 'appareil' : 'ligne';
    }

    public function nomSalarie(): string
    {
        if ($this->personnel) {
            return trim("{$this->personnel->nom} {$this->personnel->prenom}");
        }

        return $this->salarie_nom ?: '—';
    }

    /**
     * Garde-fou sur la règle « un seul objet par détention » : la contrainte
     * n'existe pas en base (pas de CHECK, pour rester portable), donc elle est
     * tenue ici, à chaque écriture. Sans ça, une ligne portant un appareil ET
     * un numéro ferait silencieusement réapparaître le défaut que la séparation
     * corrige : la ligne SIM qui semble changer de mains quand le téléphone
     * casse.
     */
    protected static function booted(): void
    {
        static::saving(function (TelephonieDetention $detention) {
            $aAppareil = !empty($detention->appareil_id);
            $aLigne = !empty($detention->ligne_id);

            if ($aAppareil === $aLigne) {
                throw new InvalidArgumentException(
                    'Une détention porte sur un appareil OU une ligne, jamais les deux ni aucun des deux.'
                );
            }
        });
    }
}
