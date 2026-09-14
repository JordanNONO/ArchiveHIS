<?php

namespace App\Notifications;

use App\Models\AppelTelephonique;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Envoyée à la personne désignée comme "concernée" par un appel téléphonique
 * (AppelTelephonique::personnel_concerne_id) — seulement si cette fiche
 * Personnels est reliée à un compte Utilisateurs (voir
 * AppelTelephoniqueController::notifierPersonneConcernee()), même logique que
 * DocumentSharedNotification pour les documents.
 */
class AppelTelephoniqueNotification extends Notification
{
    use Queueable;

    public function __construct(
        public AppelTelephonique $appel,
        public string $agentNom,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'appel',
            'titre' => 'Un appel vous concerne',
            'message' => "{$this->agentNom} a reçu un appel de {$this->appel->appelant_nom}"
                . ($this->appel->objet ? " — {$this->appel->objet}" : ''),
            'lien' => "/appels?appel={$this->appel->id}",
            'appel_id' => $this->appel->id,
        ];
    }
}
