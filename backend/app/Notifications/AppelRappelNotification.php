<?php

namespace App\Notifications;

use App\Models\AppelTelephonique;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Rappel pour un appel toujours "non traité" 7 jours après sa réception —
 * voir RelancerAppelsEnAttente. Phrasée comme un rappel ("toujours pas
 * traité"), volontairement distincte d'AppelTelephoniqueNotification ("a
 * appelé") pour ne jamais laisser croire qu'un nouvel appel vient d'arriver.
 */
class AppelRappelNotification extends Notification
{
    use Queueable;

    public function __construct(public AppelTelephonique $appel)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        $appel = $this->appel;
        $appelant = trim(($appel->appelant_nom ?: 'Un correspondant')
            . ($appel->appelant_organisation ? " ({$appel->appelant_organisation})" : ''));
        $sujet = $appel->objet ? " au sujet de « {$appel->objet} »" : '';
        $date = $appel->date_appel ? $appel->date_appel->format('d/m/Y') : '';

        return [
            'type' => 'appel_rappel',
            'titre' => 'Appel toujours pas traité',
            'message' => "L'appel de {$appelant}{$sujet}, reçu le {$date}, n'a toujours pas été traité.",
            'lien' => "/appels?appel={$appel->id}",
            'appel_id' => $appel->id,
        ];
    }
}
