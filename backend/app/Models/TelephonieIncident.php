<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Pertes, casses, vols et dépassements de forfait — ce qui était la section
 * "telephone" de la Fluctuation RH jusqu'au 16/11/2026.
 *
 * Quand la suite donnée est une retenue sur salaire, l'incident crée la ligne
 * correspondante dans la Fluctuation RH et garde son identifiant : le module
 * ne rapatrie pas la paie chez lui, il continue d'écrire là où elle se lit.
 */
class TelephonieIncident extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'telephonie_incidents';

    public const NATURES = ['perte', 'casse', 'vol', 'depassement_forfait', 'autre'];

    public const SUITES = ['a_decider', 'prise_en_charge', 'retenue_salaire', 'assurance', 'sans_suite'];

    /** Les natures qui mettent l'appareil hors service, et l'état qui en découle. */
    public const ETAT_APPAREIL_APRES = [
        'perte' => 'perdu',
        'vol' => 'vole',
        'casse' => 'hors_service',
    ];

    protected $fillable = [
        'personnel_id',
        'salarie_nom',
        'appareil_id',
        'ligne_id',
        'date_incident',
        'nature',
        'montant',
        'suite_donnee',
        'fluctuation_rh_id',
        'justificatif_document_id',
        'observations',
        'cree_par_id',
    ];

    protected $casts = [
        'date_incident' => 'date',
        'montant' => 'decimal:2',
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

    public function retenue()
    {
        return $this->belongsTo(FluctuationRh::class, 'fluctuation_rh_id');
    }

    public function justificatif()
    {
        return $this->belongsTo(DocumentArchive::class, 'justificatif_document_id');
    }

    public function creePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'cree_par_id');
    }

    /** Ce qui attend encore une décision — la seule liste vraiment actionnable. */
    public function scopeSansSuite($query)
    {
        return $query->where('suite_donnee', 'a_decider');
    }

    /**
     * Le nom à afficher : la fiche du personnel quand elle existe, sinon le
     * nom écrit à la main (incidents repris de la Fluctuation RH, salariés
     * partis, homonymes non rattachés).
     */
    public function nomSalarie(): string
    {
        if ($this->personnel) {
            return trim("{$this->personnel->nom} {$this->personnel->prenom}");
        }

        return $this->salarie_nom ?: '—';
    }
}
