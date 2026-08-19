<?php

namespace App\Notifications;

use App\Models\DocumentArchive;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Variante purement informative de DocumentNeedsValidationNotification — pour
 * un document archivé directement en "Déjà traité" (voir
 * DocumentController::store()), où il n'y a rien à valider : on prévient
 * juste que le document existe, sans laisser croire à une action attendue.
 */
class DocumentArchiveInfoNotification extends Notification
{
    use Queueable;

    public function __construct(public DocumentArchive $document)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        $extension = pathinfo($this->document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION);

        return [
            'type' => 'archive_info',
            'titre' => 'Document archivé',
            'message' => "« {$this->document->titre_document} » a été archivé",
            'lien' => "/view/{$this->document->id}/{$extension}",
            'document_id' => $this->document->id,
        ];
    }
}
