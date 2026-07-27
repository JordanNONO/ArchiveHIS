<?php

namespace App\Events;

use App\Models\DocumentArchive;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Diffusé après chaque changement de statut, pour que toute personne ayant déjà
 * la page du document ouverte voie le badge et l'historique se mettre à jour sans
 * avoir à rafraîchir — utile quand deux personnes travaillent sur le même document
 * en même temps (ex: un éditeur modifie pendant qu'un admin consulte).
 */
class DocumentStatutMisAJour implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public DocumentArchive $document)
    {
    }

    public function broadcastOn(): array
    {
        return [new Channel('document.' . $this->document->id)];
    }

    public function broadcastAs(): string
    {
        return 'statut.maj';
    }

    public function broadcastWith(): array
    {
        return [
            'document_id' => $this->document->id,
            'status_doc' => $this->document->status_doc,
            'date_archivage' => $this->document->date_archivage,
        ];
    }
}
