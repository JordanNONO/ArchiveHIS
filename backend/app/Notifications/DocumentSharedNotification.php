<?php

namespace App\Notifications;

use App\Models\DocumentArchive;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DocumentSharedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public DocumentArchive $document,
        public string $expediteurNom,
        public ?string $message = null,
        public ?string $serviceNom = null,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        $extension = pathinfo($this->document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION);

        return [
            'type' => $this->serviceNom ? 'transmission_service' : 'partage',
            'titre' => $this->serviceNom ? 'Document transmis à votre service' : 'Document partagé',
            'message' => $this->serviceNom
                ? "{$this->expediteurNom} a transmis « {$this->document->titre_document} » au service {$this->serviceNom}"
                : "{$this->expediteurNom} vous a partagé « {$this->document->titre_document} »",
            'lien' => "/view/{$this->document->id}/{$extension}",
            'document_id' => $this->document->id,
        ];
    }
}
