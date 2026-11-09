<?php

namespace App\Notifications;

use App\Models\DocumentArchive;
use App\Notifications\Channels\WebPushChannel;
use App\Support\CibleNotification;
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

        $document = $this->document;
        $lien = "/view/{$document->id}/{$extension}";
        // Depuis quand il traîne : la deadline dépassée, sinon la réception.
        $depuis = $this->deadlineDepassee ? $document->deadline_courrier : $document->created_at;
        $jours = $depuis ? (int) now()->startOfDay()->diffInDays($depuis->copy()->startOfDay(), true) : 0;

        // Nouveau modèle (maquette « Notifications HIS ») : verbe d'action en
        // titre, le service Administratif (qui reçoit ces relances, voir
        // RelancerCourriersEnAttente) en « pour qui » carré.
        return [
            'type' => 'courrier',
            'titre' => "Traiter « {$document->titre_document} »",
            'message' => $this->deadlineDepassee
                ? 'Deadline dépassée le ' . $document->deadline_courrier->format('d/m')
                : 'En attente depuis plus de 7 jours',
            'details' => [
                $this->deadlineDepassee
                    ? "Le courrier entrant « {$document->titre_document} » a dépassé sa deadline et reste \"En attente\"."
                    : "Le courrier entrant « {$document->titre_document} » reste \"En attente\" depuis plus de 7 jours.",
            ],
            'cible' => CibleNotification::secteur('Administratif'),
            'urgence' => [
                'niveau' => 'retard',
                'libelle' => ($this->deadlineDepassee ? 'EN RETARD' : 'EN ATTENTE') . ($jours > 0 ? " +{$jours} J" : ''),
            ],
            'contexte' => 'Courrier',
            'persistante' => true,
            'tag' => "courrier-{$document->id}",
            'actions' => [
                ['action' => 'ouvrir', 'titre' => 'Traiter', 'lien' => $lien],
                ['action' => 'reporter', 'titre' => 'Rappeler dans 1 h'],
            ],
            'lien' => $lien,
            'document_id' => $this->document->id,
        ];
    }
}
