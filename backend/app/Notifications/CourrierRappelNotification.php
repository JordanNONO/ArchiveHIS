<?php

namespace App\Notifications;

use App\Models\DocumentArchive;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Rappel pour un courrier entrant toujours "En attente" — soit sa deadline
 * est dépassée, soit il traîne depuis trop longtemps sans deadline précisée
 * (voir RelancerCourriersEnAttente). Le message précise explicitement qu'il
 * s'agit d'un courrier, pour ne pas être confondu avec les autres rappels
 * de l'application (ex: DelaiCorrectionDepasseNotification).
 */
class CourrierRappelNotification extends Notification
{
    use Queueable;

    public function __construct(public DocumentArchive $document, public bool $deadlineDepassee)
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
            'type' => 'courrier',
            'titre' => $this->deadlineDepassee ? 'Courrier : deadline dépassée' : 'Courrier en attente',
            'message' => $this->deadlineDepassee
                ? "Le courrier entrant « {$this->document->titre_document} » a dépassé sa deadline et reste \"En attente\"."
                : "Le courrier entrant « {$this->document->titre_document} » reste \"En attente\" depuis plus de 7 jours.",
            'lien' => "/view/{$this->document->id}/{$extension}",
            'document_id' => $this->document->id,
        ];
    }
}
