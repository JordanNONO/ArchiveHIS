<?php

namespace App\Notifications;

use App\Models\DocumentArchive;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Relance envoyée quand le délai de correction (3 jours) d'un document
 * rejeté est dépassé — des deux côtés à la fois (voir corrections:relancer) :
 * le déposant (pour qu'il corrige et renvoie), et le service concerné (pour
 * qu'il sache que le dossier traîne toujours, sans action de sa part).
 */
class DelaiCorrectionDepasseNotification extends Notification
{
    use Queueable;

    public function __construct(public DocumentArchive $document, public bool $pourDeposant)
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
            'type' => 'statut',
            'titre' => $this->pourDeposant ? 'Correction toujours en attente' : 'Correction en retard',
            'message' => $this->pourDeposant
                ? "Le délai de 3 jours pour corriger et renvoyer « {$this->document->titre_document} » est dépassé."
                : "« {$this->document->titre_document} » attend toujours sa correction par le déposant, le délai de 3 jours est dépassé.",
            'lien' => "/view/{$this->document->id}/{$extension}",
            'document_id' => $this->document->id,
        ];
    }
}
