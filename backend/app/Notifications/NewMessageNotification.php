<?php

namespace App\Notifications;

use App\Models\Message;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Nouveau message reçu — mêmes canaux que les autres notifications
 * (database + broadcast + WebPush, voir DocumentSharedNotification), pour
 * apparaître dans la cloche 🔔 et déclencher une notification système même
 * onglet fermé. Le son lui-même reste à part (playMessageSound(), voir
 * MessagerieContext.jsx/NotificationBell.jsx) : le canal "broadcast" ici
 * double aussi l'événement MessageEnvoye déjà diffusé pour le panneau/les
 * fenêtres flottantes — NotificationBell.jsx ne rejoue donc pas le son
 * générique pour ce type précis, pour éviter un double son au même instant.
 */
class NewMessageNotification extends Notification
{
    use Queueable;

    public function __construct(public Message $message, public string $expediteurNom)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'message_recu',
            'titre' => $this->expediteurNom,
            'message' => $this->message->contenu,
            'lien' => null,
            'conversation_id' => $this->message->conversation_id,
            'expediteur_id' => $this->message->utilisateur_id,
        ];
    }
}
