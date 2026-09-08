<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Diffusé quand un document part à la corbeille — pour que toute personne
 * ayant déjà la page ouverte le sache immédiatement (voir
 * DocumentStatutMisAJour, même principe pour les changements de statut).
 */
class DocumentSupprime implements ShouldBroadcastNow
{
    use Dispatchable;

    public function __construct(public int $documentId)
    {
    }

    public function broadcastOn(): array
    {
        return [new Channel('document.' . $this->documentId)];
    }

    public function broadcastAs(): string
    {
        return 'document.supprime';
    }

    public function broadcastWith(): array
    {
        return ['document_id' => $this->documentId];
    }
}
