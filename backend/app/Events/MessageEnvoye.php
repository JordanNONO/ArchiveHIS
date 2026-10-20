<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Diffusé à chaque message envoyé, sur le canal personnel de chaque
 * participant (même canal privé "App.Models.Utilisateurs.{id}" que les
 * Notifications, voir NotificationBell.jsx) plutôt qu'un canal par
 * conversation — un seul abonnement déjà en place côté frontend suffit à
 * tenir à jour aussi bien la liste des conversations que les fenêtres
 * ouvertes, sans logique d'abonnement supplémentaire par conversation.
 */
class MessageEnvoye implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /** @param int[] $destinatairesIds */
    public function __construct(public Message $message, public array $destinatairesIds)
    {
    }

    public function broadcastOn(): array
    {
        return array_map(fn ($id) => new PrivateChannel('App.Models.Utilisateurs.' . $id), $this->destinatairesIds);
    }

    public function broadcastAs(): string
    {
        return 'message.envoye';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'utilisateur_id' => $this->message->utilisateur_id,
            'contenu' => $this->message->contenu,
            'created_at' => $this->message->created_at,
        ];
    }
}
