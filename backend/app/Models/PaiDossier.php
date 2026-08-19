<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Projet d'Accompagnement Individualisé — un dossier de suivi qui ne se ferme
 * jamais automatiquement (voir la réunion qualité du 2026-08-16 : "des
 * dossiers qui ne doivent jamais être fermés, dans lesquels on a toujours un
 * suivi dynamique en continu"). Distinct de DocumentArchive, dont le cycle de
 * vie se termine toujours par un statut final.
 */
class PaiDossier extends Model
{
    protected $fillable = [
        'titre',
        'personnel_concerne_id',
        'nom_beneficiaire',
        'responsable_secteur_id',
        'categorie_id',
        'description',
        'date_ouverture',
        'date_cloture',
        'cree_par_id',
    ];

    protected $casts = [
        'date_ouverture' => 'date',
        'date_cloture' => 'date',
    ];

    public function beneficiaire(): BelongsTo
    {
        return $this->belongsTo(Personnels::class, 'personnel_concerne_id');
    }

    /** Nom du bénéficiaire, qu'il ait un compte ou non — même logique que DocumentArchive::nomPersonneConcernee(). */
    public function nomBeneficiaire(): string
    {
        if ($this->beneficiaire) {
            return trim("{$this->beneficiaire->prenom} {$this->beneficiaire->nom}");
        }
        return $this->nom_beneficiaire ?? '';
    }

    public function responsableSecteur(): BelongsTo
    {
        return $this->belongsTo(Utilisateurs::class, 'responsable_secteur_id');
    }

    public function categorie(): BelongsTo
    {
        return $this->belongsTo(CategorieDocument::class, 'categorie_id');
    }

    public function creePar(): BelongsTo
    {
        return $this->belongsTo(Utilisateurs::class, 'cree_par_id');
    }

    public function objectifs(): HasMany
    {
        return $this->hasMany(PaiObjectif::class);
    }

    public function estCloture(): bool
    {
        return $this->date_cloture !== null;
    }
}
