<?php

namespace App\Notifications;

use App\Models\AppelTelephonique;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Envoyée à la création (ou réassignation) d'un appel téléphonique — voir
 * AppelTelephoniqueController::notifierPersonneConcernee(), qui l'envoie sous
 * deux formes : un message personnalisé ("Un appel vous concerne") à la
 * personne désignée comme "concernée" (AppelTelephonique::personnel_concerne_id),
 * et un message générique ("Nouvel appel enregistré") au reste du personnel
 * ayant accès au registre. Même logique de base que DocumentSharedNotification
 * pour les documents.
 */
class AppelTelephoniqueNotification extends Notification
{
    use Queueable;

    public function __construct(
        public AppelTelephonique $appel,
        public string $agentNom,
        public bool $estPersonneConcernee = true,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        $appelantNom = $this->appel->appelant_nom ?: 'un correspondant';

        return [
            'type' => 'appel',
            'titre' => $this->estPersonneConcernee ? 'Un appel vous concerne' : 'Nouvel appel enregistré',
            'message' => "{$this->agentNom} a reçu un appel de {$appelantNom}"
                . ($this->appel->objet ? " — {$this->appel->objet}" : ''),
            'lien' => "/appels?appel={$this->appel->id}",
            'appel_id' => $this->appel->id,
            // Voir DocumentSharedNotification — prévient l'agent quand la
            // personne concernée a vu qu'un appel lui était destiné. Pas pour
            // le message générique envoyé au reste du personnel (spam à
            // chaque lecture par n'importe qui).
            'expediteur_id' => $this->estPersonneConcernee ? $this->appel->utilisateur_id : null,
        ];
    }
}
