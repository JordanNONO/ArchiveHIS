<?php

namespace App\Notifications;

use App\Models\PaiDossier;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Escalade vers l'administration quand un objectif de PAI reste en retard
 * PaiObjectif::JOURS_AVANT_ESCALADE jours après la première alerte, sans
 * action du responsable de secteur — mirroir de DelaiDepasseNotification
 * (passage au rouge de SuiviDelai), pour ne jamais laisser une alerte ignorée
 * disparaître silencieusement.
 */
class PaiObjectifEscaladeNotification extends Notification
{
    use Queueable;

    public function __construct(public PaiDossier $dossier, public int $nbEscalades)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        $pluriel = $this->nbEscalades > 1;
        $responsable = $this->dossier->responsableSecteur?->nom ?? 'le responsable de secteur assigné';

        return [
            'type' => 'pai_escalade',
            'titre' => 'PAI en retard non traité',
            'message' => "« {$this->dossier->titre} » ({$this->dossier->nomBeneficiaire()}) a {$this->nbEscalades} objectif" . ($pluriel ? 's' : '') . " toujours en retard malgré l'alerte envoyée à {$responsable}",
            'lien' => "/pai/{$this->dossier->id}",
            'pai_dossier_id' => $this->dossier->id,
        ];
    }
}
