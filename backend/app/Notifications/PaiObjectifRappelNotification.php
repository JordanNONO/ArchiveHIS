<?php

namespace App\Notifications;

use App\Models\PaiDossier;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Rappel proactif envoyé au responsable de secteur avant l'échéance d'un
 * objectif de PAI (J-3) — distinct de PaiObjectifEnRetardNotification, qui ne
 * se déclenche qu'une fois l'échéance dépassée. Voir la réunion qualité du
 * 2026-08-16 : la double alerte doit prévenir en amont, pas seulement constater
 * le retard après coup.
 */
class PaiObjectifRappelNotification extends Notification
{
    use Queueable;

    public function __construct(public PaiDossier $dossier, public int $nbAVenir)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        $pluriel = $this->nbAVenir > 1;

        return [
            'type' => 'pai_rappel',
            'titre' => 'PAI à échéance proche',
            'message' => "« {$this->dossier->titre} » ({$this->dossier->nomBeneficiaire()}) a {$this->nbAVenir} objectif" . ($pluriel ? 's' : '') . ' à échéance dans les 3 prochains jours',
            'lien' => "/pai/{$this->dossier->id}",
            'pai_dossier_id' => $this->dossier->id,
        ];
    }
}
