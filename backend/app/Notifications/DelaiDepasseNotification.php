<?php

namespace App\Notifications;

use App\Models\SuiviDelai;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DelaiDepasseNotification extends Notification
{
    use Queueable;

    public function __construct(public SuiviDelai $suivi)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable): array
    {
        $document = $this->suivi->documentDeclencheur;
        $etape = $this->suivi->etapeWorkflow;
        $extension = pathinfo($document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION);
        $concerne = $document->nom_concerne;

        return [
            'type' => 'delai_depasse',
            'titre' => 'Délai dépassé',
            'message' => "« {$etape->nom} »" . ($concerne ? " pour {$concerne}" : '') . " a dépassé son délai" . ($etape->serviceResponsable ? " ({$etape->serviceResponsable->nom_service})" : ''),
            'lien' => "/view/{$document->id}/{$extension}",
            'document_id' => $document->id,
            'suivi_delai_id' => $this->suivi->id,
        ];
    }
}
