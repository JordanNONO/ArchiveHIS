<?php

namespace App\Models;

use App\Enums\NiveauAlerte;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SuiviDelai extends Model
{
    use HasFactory;

    protected $table = 'suivis_delais';

    protected $fillable = [
        'document_declencheur_id',
        'personnel_concerne_id',
        'etape_workflow_id',
        'etape_demarree_le',
        'echeance_le',
        'niveau_alerte',
        'manager_notifie_le',
        'termine_le',
        'utilisateur_id',
    ];

    protected $casts = [
        'etape_demarree_le' => 'datetime',
        'echeance_le' => 'datetime',
        'manager_notifie_le' => 'datetime',
        'termine_le' => 'datetime',
    ];

    public function documentDeclencheur()
    {
        return $this->belongsTo(DocumentArchive::class, 'document_declencheur_id');
    }

    public function personnelConcerne()
    {
        return $this->belongsTo(Personnels::class, 'personnel_concerne_id');
    }

    public function etapeWorkflow()
    {
        return $this->belongsTo(EtapeWorkflow::class, 'etape_workflow_id');
    }

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function estActif(): bool
    {
        return $this->termine_le === null;
    }

    /**
     * Recalcule le niveau d'alerte à partir de l'échéance et, si l'étape en a un,
     * du seuil d'alerte orange — sans écrire en base (voir VerifierEcheancesDelais
     * pour la persistance + la notification d'escalade sur passage au rouge).
     */
    public function niveauAlerteCourant(): NiveauAlerte
    {
        $seuil = $this->etapeWorkflow->seuil_alerte_heures
            ? $this->echeance_le->clone()->subHours($this->etapeWorkflow->seuil_alerte_heures)
            : null;

        return NiveauAlerte::calculer($this->echeance_le, $seuil, now());
    }
}
