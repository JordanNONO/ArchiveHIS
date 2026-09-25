<?php

namespace App\Notifications;

use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Envoyée quand une session n'a plus donné signe de vie depuis ~118 minutes
 * (voir la commande inactivite:alerter) — couvre le cas où le navigateur est
 * fermé (ou l'ordinateur en veille), où AlerteInactivite.jsx ne peut rien
 * afficher puisqu'aucun code ne tourne côté client. Le canal WebPush est ce
 * qui rend ceci utile ici : une vraie notification système, même appli
 * fermée, contrairement au son/à la fenêtre du composant client.
 */
class InactiviteImminenteNotification extends Notification
{
    use Queueable;

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'inactivite_imminente',
            'titre' => 'Vous êtes toujours là ?',
            'message' => "Par sécurité, votre session HIS Archivage va se fermer dans 2 minutes faute d'activité.",
            'lien' => null,
        ];
    }
}
