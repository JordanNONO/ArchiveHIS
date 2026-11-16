<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Un téléphone du parc. Voir la migration creer_telephonie_appareils_table
 * pour pourquoi tout est facultatif sauf le modèle.
 */
class TelephonieAppareil extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'telephonie_appareils';

    public const ETATS = ['en_stock', 'en_service', 'hors_service', 'reforme', 'perdu', 'vole'];

    /** Un appareil dans l'un de ces états ne peut plus être remis à personne. */
    public const ETATS_INDISPONIBLES = ['hors_service', 'reforme', 'perdu', 'vole'];

    protected $fillable = [
        'modele',
        'imei',
        'numero_serie',
        'date_achat',
        'prix_achat',
        'etat',
        'observations',
        'fiche_a_completer',
        'cree_par_id',
    ];

    protected $casts = [
        'date_achat' => 'date',
        'prix_achat' => 'decimal:2',
        'fiche_a_completer' => 'boolean',
    ];

    public function attributions()
    {
        return $this->hasMany(TelephonieAttribution::class, 'appareil_id');
    }

    /** L'attribution en cours, s'il y en a une — celle qui n'a pas été restituée. */
    public function attributionEnCours()
    {
        return $this->hasOne(TelephonieAttribution::class, 'appareil_id')
            ->whereNull('date_restitution')
            ->latestOfMany('date_remise');
    }

    public function incidents()
    {
        return $this->hasMany(TelephonieIncident::class, 'appareil_id');
    }

    public function creePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'cree_par_id');
    }

    /**
     * Les appareils qu'on peut remettre à quelqu'un : en état de servir, et
     * que personne ne détient déjà. Le second critère ne se déduit pas de
     * `etat` — un appareil peut rester marqué "en_service" alors que son
     * détenteur l'a rendu, tant que personne n'a mis la fiche à jour.
     */
    public function scopeDisponible($query)
    {
        return $query->whereNotIn('etat', self::ETATS_INDISPONIBLES)
            ->whereDoesntHave('attributions', fn ($q) => $q->whereNull('date_restitution'));
    }

    /**
     * Renseigner l'IMEI, la date d'achat et le prix lève le drapeau de la
     * reprise : la fiche créée à la va-vite est devenue une vraie fiche.
     */
    public function rafraichirFicheACompleter(): void
    {
        $this->fiche_a_completer = !($this->imei && $this->date_achat && $this->prix_achat !== null);
    }
}
