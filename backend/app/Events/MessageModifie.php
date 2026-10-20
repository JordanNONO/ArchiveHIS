<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** Même principe que MessageEnvoye.php — un message modifié se met à jour en direct dans la fenêtre de l'autre participant. */
class MessageModifie implements ShouldBroadcastNow
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
        return 'message.modifie';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->message->id,
            'conversation_id' => $this->message->conversation_id,
            'contenu' => $this->message->contenu,
            'modifie_le' => $this->message->modifie_le,
        ];
    }
}
