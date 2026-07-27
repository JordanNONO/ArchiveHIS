<?php

namespace App\Notifications;

use App\Enums\StatutDocument;
use App\Models\DocumentArchive;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DocumentStatusChangedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public DocumentArchive $document,
        public StatutDocument $nouveauStatut,
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
            'type' => 'statut',
            'titre' => 'Statut mis à jour',
            'message' => "« {$this->document->titre_document} » est maintenant « {$this->nouveauStatut->libelle()} »",
            'lien' => "/view/{$this->document->id}/{$extension}",
            'document_id' => $this->document->id,
            'nouveau_statut' => $this->nouveauStatut->value,
        ];
    }
}
