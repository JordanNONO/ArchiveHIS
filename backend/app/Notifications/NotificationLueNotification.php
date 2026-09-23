<?php

namespace App\Notifications;

use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Accusé de lecture envoyé à l'expéditeur d'une notification 1-vers-1 (voir
 * NotificationController::notifierExpediteurSiPertinent()) quand son
 * destinataire l'ouvre — pour le rassurer que l'information est bien
 * arrivée, sans avoir à relancer la personne pour savoir si elle a vu.
 */
class NotificationLueNotification extends Notification
{
    use Queueable;

    public function __construct(
        public string $lecteurNom,
        public string $titreOriginal,
        public ?string $lien = null,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'lu',
            'titre' => "Vu par {$this->lecteurNom}",
            'message' => "{$this->lecteurNom} a consulté « {$this->titreOriginal} »",
            'lien' => $this->lien,
        ];
    }
}
