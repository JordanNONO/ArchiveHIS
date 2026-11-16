<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Une ligne SIM : le numéro, son forfait, ce qu'il coûte et jusqu'à quand il
 * engage. Indépendante de l'appareil (voir TelephonieAppareil).
 */
class TelephonieLigne extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'telephonie_lignes';

    public const STATUTS = ['active', 'suspendue', 'resiliee'];

    protected $fillable = [
        'numero',
        'operateur',
        'forfait',
        'cout_mensuel',
        'iccid',
        'code_pin',
        'code_puk',
        'date_souscription',
        'engagement_jusquau',
        'statut',
        'observations',
        'fiche_a_completer',
        'cree_par_id',
    ];

    protected $casts = [
        'cout_mensuel' => 'decimal:2',
        'date_souscription' => 'date',
        'engagement_jusquau' => 'date',
        'fiche_a_completer' => 'boolean',
        // Chiffrés en base : ce sont des codes d'accès. Ils ne doivent jamais
        // partir dans une liste — voir $hidden ci-dessous, qui les retire des
        // réponses JSON par défaut. Les lire passe par une route dédiée qui
        // journalise l'accès.
        'code_pin' => 'encrypted',
        'code_puk' => 'encrypted',
    ];

    protected $hidden = ['code_pin', 'code_puk'];

    /** Vrai si des codes existent, sans jamais les révéler — pour l'affichage. */
    protected $appends = ['a_des_codes'];

    public function getADesCodesAttribute(): bool
    {
        return !empty($this->attributes['code_pin']) || !empty($this->attributes['code_puk']);
    }

    public function detentions()
    {
        return $this->hasMany(TelephonieDetention::class, 'ligne_id');
    }

    /**
     * Qui a ce numéro aujourd'hui. Cette détention-là ne s'interrompt pas
     * quand le téléphone du salarié casse : c'est tout l'intérêt d'avoir
     * séparé l'appareil de la ligne (voir la migration des détentions).
     */
    public function detentionEnCours()
    {
        return $this->hasOne(TelephonieDetention::class, 'ligne_id')
            ->whereNull('date_fin')
            ->latestOfMany('date_debut');
    }

    public function incidents()
    {
        return $this->hasMany(TelephonieIncident::class, 'ligne_id');
    }

    public function creePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'cree_par_id');
    }

    /** Lignes qu'on peut attribuer : actives et détenues par personne. */
    public function scopeLibre($query)
    {
        return $query->where('statut', 'active')
            ->whereDoesntHave('detentions', fn ($q) => $q->whereNull('date_fin'));
    }

    /**
     * Une ligne active que personne n'utilise est un forfait payé pour rien —
     * c'est l'alerte qui se rentabilise toute seule, et celle qu'un suivi de
     * tête ne voit jamais. `scopeLibre` sert aussi à proposer les lignes à la
     * remise : ici on ne garde que celles qui coûtent quelque chose.
     */
    public function scopeFacturationInutile($query)
    {
        return $query->libre()->where('cout_mensuel', '>', 0);
    }
}
