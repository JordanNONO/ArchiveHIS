<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/** Même principe que MessageEnvoye.php — le message est déjà supprimé en base au moment de la diffusion, seul son id sert à le retirer du fil affiché chez l'autre participant. */
class MessageSupprime implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /** @param int[] $destinatairesIds */
    public function __construct(public int $messageId, public int $conversationId, public array $destinatairesIds)
    {
    }

    public function broadcastOn(): array
    {
        return array_map(fn ($id) => new PrivateChannel('App.Models.Utilisateurs.' . $id), $this->destinatairesIds);
    }

    public function broadcastAs(): string
    {
        return 'message.supprime';
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->messageId,
            'conversation_id' => $this->conversationId,
        ];
    }
}
