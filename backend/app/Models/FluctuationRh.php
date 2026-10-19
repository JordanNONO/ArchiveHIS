<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Une ligne du tableau de fluctuation RH d'un mois — voir la migration
 * create_fluctuations_rh_tables pour le contexte.
 *
 * Correspondance colonnes du tableur -> champs, par section :
 * - entree     : date d'entrée (date_debut), date de sortie si CDD (date_fin), heures au contrat
 * - stagiaire  : date d'entrée, date de sortie, observations
 * - sortie     : date d'entrée dans l'association (date_debut), date de sortie (date_fin), motif
 * - absence    : période (date_debut/date_fin), motif, observations
 * - avenant    : à compter du (date_debut), heures au contrat
 * - conge      : période, motif (congés payés, sans solde...)
 * - ferie      : date (date_debut), motif (jour férié travaillé)
 * - acompte    : date, montant, observations (échéancier)
 * - retenue    : date, montant, observations
 * - formation  : période, motif (intitulé de la formation)
 * - telephone  : date, montant, motif (perte, dépassement de forfait...)
 * - discipline : date de prise d'effet, motif (avertissement, mise à pied...)
 * - dossier    : observations (pièce ou information mise à jour)
 */
class FluctuationRh extends Model
{
    protected $table = 'fluctuations_rh';

    public const SECTIONS = ['entree', 'stagiaire', 'sortie', 'absence', 'avenant', 'conge', 'ferie', 'acompte', 'retenue', 'formation', 'telephone', 'discipline', 'dossier'];

    protected $fillable = [
        'mois',
        'section',
        'salarie',
        'date_debut',
        'date_fin',
        'motif',
        'heures',
        'montant',
        'observations',
        'utilisateur_id',
        'modifie_par_id',
    ];

    protected $casts = [
        'mois' => 'date:Y-m-d',
        'date_debut' => 'date:Y-m-d',
        'date_fin' => 'date:Y-m-d',
        'montant' => 'decimal:2',
    ];

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function modifiePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'modifie_par_id');
    }
}
