<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PaiObjectif extends Model
{
    /** Délai entre la première alerte de retard et l'escalade vers l'administration. */
    public const JOURS_AVANT_ESCALADE = 7;

    /** Nombre de jours avant l'échéance à partir duquel le rappel proactif part. */
    public const JOURS_AVANT_RAPPEL = 3;

    protected $fillable = [
        'pai_dossier_id',
        'description',
        'echeance',
        'fait',
        'date_realisation',
        'realise_par_id',
        'alerte_envoyee_le',
        'rappel_envoye_le',
        'escalade_envoyee_le',
    ];

    protected $casts = [
        'echeance' => 'date',
        'date_realisation' => 'date',
        'fait' => 'boolean',
        'alerte_envoyee_le' => 'datetime',
        'rappel_envoye_le' => 'datetime',
        'escalade_envoyee_le' => 'datetime',
    ];

    public function dossier(): BelongsTo
    {
        return $this->belongsTo(PaiDossier::class, 'pai_dossier_id');
    }

    public function realisePar(): BelongsTo
    {
        return $this->belongsTo(Utilisateurs::class, 'realise_par_id');
    }

    /**
     * Jamais stocké : un objectif est "en retard" s'il n'est pas fait et que
     * son échéance est passée — recalculé à chaque lecture pour ne jamais
     * désynchroniser de la date du jour.
     */
    public function estEnRetard(): bool
    {
        return !$this->fait && $this->echeance->isPast();
    }

    /**
     * Fenêtre de rappel proactif : à J-3 de l'échéance, avant qu'elle ne soit
     * dépassée — but explicite de la réunion qualité du 2026-08-16, éviter que
     * l'alerte n'arrive qu'après coup.
     */
    public function necessiteRappel(): bool
    {
        if ($this->fait || $this->rappel_envoye_le !== null) {
            return false;
        }
        return now()->toDateString() >= $this->echeance->clone()->subDays(self::JOURS_AVANT_RAPPEL)->toDateString()
            && !$this->estEnRetard();
    }

    /**
     * Un objectif reste en retard sans action du responsable de secteur
     * JOURS_AVANT_ESCALADE jours après la première alerte : ça remonte à
     * l'administration plutôt que de rester silencieux indéfiniment.
     */
    public function necessiteEscalade(): bool
    {
        if ($this->fait || $this->alerte_envoyee_le === null || $this->escalade_envoyee_le !== null) {
            return false;
        }
        return $this->alerte_envoyee_le->lte(now()->subDays(self::JOURS_AVANT_ESCALADE));
    }
}
