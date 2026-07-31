<?php

namespace App\Notifications;

use App\Models\FolderExport;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\URL;

class FolderExportReadyNotification extends Notification
{
    use Queueable;

    public function __construct(
        public FolderExport $export,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast'];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'export_pret',
            'titre' => 'Téléchargement prêt',
            'message' => "L'archive de « {$this->export->nom_dossier} » est prête à être téléchargée.",
            'lien' => URL::temporarySignedRoute(
                'telechargements.fichier',
                now()->addHours(24),
                ['id' => $this->export->id]
            ),
            'export_id' => $this->export->id,
        ];
    }
}
