<?php

namespace App\Notifications;

use App\Models\CategorieDocument;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class FolderSharedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public CategorieDocument $folder,
        public string $expediteurNom,
        public ?string $message = null,
        public ?string $serviceNom = null,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => $this->serviceNom ? 'transmission_service' : 'partage',
            'titre' => $this->serviceNom ? 'Dossier transmis à votre service' : 'Dossier partagé',
            'message' => $this->serviceNom
                ? "{$this->expediteurNom} a transmis le dossier « {$this->folder->libelle_cat} » au service {$this->serviceNom}"
                : "{$this->expediteurNom} vous a partagé le dossier « {$this->folder->libelle_cat} »",
            'lien' => "/folder/{$this->folder->id}",
            'categorie_id' => $this->folder->id,
        ];
    }
}
