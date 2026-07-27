<?php

namespace App\Notifications;

use App\Models\DocumentArchive;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DocumentNeedsValidationNotification extends Notification
{
    use Queueable;

    public function __construct(public DocumentArchive $document)
    {
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        $extension = pathinfo($this->document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION);

        return [
            'type' => 'a_valider',
            'titre' => 'Document à valider',
            'message' => "« {$this->document->titre_document} » a été soumis et attend une validation",
            'lien' => "/view/{$this->document->id}/{$extension}",
            'document_id' => $this->document->id,
        ];
    }
}
