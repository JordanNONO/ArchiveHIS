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
        // Canal par document (pour qui a la fiche ouverte) + canal global
        // "documents" (pour le tableau de bord : compteurs de dossiers,
        // rappels "à traiter", Corbeille — qui ne connaissent pas l'id à
        // l'avance et doivent réagir à n'importe quelle suppression).
        return [
            new Channel('document.' . $this->documentId),
            new Channel('documents'),
        ];
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
