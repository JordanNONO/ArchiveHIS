<?php

namespace App\Notifications;

use App\Models\PaiDossier;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PaiObjectifEnRetardNotification extends Notification
{
    use Queueable;

    public function __construct(public PaiDossier $dossier, public int $nbEnRetard)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        $pluriel = $this->nbEnRetard > 1;

        return [
            'type' => 'pai_en_retard',
            'titre' => 'PAI en retard',
            'message' => "« {$this->dossier->titre} » ({$this->dossier->nomBeneficiaire()}) a {$this->nbEnRetard} objectif" . ($pluriel ? 's' : '') . ' en retard',
            'lien' => "/pai/{$this->dossier->id}",
            'pai_dossier_id' => $this->dossier->id,
        ];
    }
}
