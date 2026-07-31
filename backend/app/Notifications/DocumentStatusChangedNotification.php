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
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable): array
    {
        $extension = pathinfo($this->document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION);
        $libelle = $notifiable->estCompteDepot() ? $this->nouveauStatut->libelleExterne() : $this->nouveauStatut->libelle();

        return [
            'type' => 'statut',
            'titre' => 'Statut mis à jour',
            'message' => "« {$this->document->titre_document} » est maintenant « {$libelle} »",
            'lien' => "/view/{$this->document->id}/{$extension}",
            'document_id' => $this->document->id,
            'nouveau_statut' => $this->nouveauStatut->value,
        ];
    }
}
