<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Diffusé quand un document est renommé, déplacé (changement de
 * dossier/sous-dossier) ou restauré depuis la corbeille — les seuls
 * changements qui modifient ce qu'affiche une liste de documents (OpenFolder)
 * sans passer par une transition de statut (déjà couverte par
 * DocumentStatutMisAJour) ni une suppression (DocumentSupprime).
 */
class DocumentModifie implements ShouldBroadcastNow
{
    use Dispatchable;

    public function __construct(public int $documentId)
    {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel('document.' . $this->documentId),
            new Channel('documents'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'document.modifie';
    }

    public function broadcastWith(): array
    {
        return ['document_id' => $this->documentId];
    }
}
