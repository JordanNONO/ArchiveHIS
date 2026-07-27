<?php

namespace App\Notifications;

use App\Models\FolderExport;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class FolderExportFailedNotification extends Notification
{
    use Queueable;

    public function __construct(
        public FolderExport $export,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'export_echoue',
            'titre' => 'Téléchargement impossible',
            'message' => "La préparation de l'archive de « {$this->export->nom_dossier} » a échoué. Réessayez ou contactez un administrateur.",
            'lien' => null,
            'export_id' => $this->export->id,
        ];
    }
}
