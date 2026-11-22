<?php

namespace App\Notifications;

use App\Models\DocumentArchive;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Un document à date de fin de validité (titre de séjour, visite médicale,
 * formation...) arrive à échéance — envoyé 60, 30 et 7 jours avant puis le
 * jour même, voir documents:rappeler-validite. Le texte change selon qu'on
 * s'adresse au salarié lui-même (« votre titre de séjour ») ou à la RH.
 */
class EcheanceDocumentNotification extends Notification
{
    use Queueable;

    public function __construct(
        public DocumentArchive $document,
        public int $joursRestants,
        public bool $pourLeSalarie,
        public string $nomSalarie,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public static function quand(int $jours): string
    {
        return match (true) {
            $jours < 0 => 'a expiré le',
            $jours === 0 => "expire aujourd'hui,",
            $jours === 1 => 'expire demain,',
            default => "expire dans {$jours} jours, le",
        };
    }

    public function toArray($notifiable): array
    {
        $d = $this->document;
        $date = $d->date_fin_validite->format('d/m/Y');
        $quand = self::quand($this->joursRestants);
        $extension = pathinfo($d->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION);

        return [
            'type' => 'echeance_document',
            'titre' => $this->pourLeSalarie
                ? "Document à renouveler — {$d->titre_document}"
                : "Échéance — {$d->titre_document} ({$this->nomSalarie})",
            'message' => $this->pourLeSalarie
                ? "Votre document « {$d->titre_document} » {$quand} {$date}. Déposez le nouveau dès que vous l'avez."
                : "« {$d->titre_document} » de {$this->nomSalarie} {$quand} {$date}.",
            'personne_concernee' => $this->nomSalarie,
            'lien' => $this->pourLeSalarie ? '/mes-documents' : "/view/{$d->id}/{$extension}",
            'document_id' => $d->id,
            'urgent' => $this->joursRestants <= 7,
        ];
    }
}
