<?php

namespace App\Notifications;

use App\Models\AppelTelephonique;
use App\Notifications\Channels\WebPushChannel;
use App\Support\CibleNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Rappel pour un appel toujours "non traité" 7 jours après sa réception —
 * voir RelancerAppelsEnAttente. Phrasée comme un rappel ("toujours pas
 * traité"), volontairement distincte d'AppelTelephoniqueNotification ("a
 * appelé") pour ne jamais laisser croire qu'un nouvel appel vient d'arriver.
 */
class AppelRappelNotification extends Notification
{
    use Queueable;

    public function __construct(public AppelTelephonique $appel)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        $appel = $this->appel;
        $appelant = trim(($appel->appelant_nom ?: 'Un correspondant')
            . ($appel->appelant_organisation ? " ({$appel->appelant_organisation})" : ''));
        $sujet = $appel->objet ? " au sujet de « {$appel->objet} »" : '';
        $date = $appel->date_appel ? $appel->date_appel->format('d/m/Y') : '';

        $lien = "/appels?appel={$appel->id}";
        $dateCourte = $appel->date_appel ? $appel->date_appel->format('d/m') : '';
        $anciennete = CibleNotification::anciennete($appel->date_appel);

        // Nouveau modèle (maquette « Notifications HIS ») : un verbe d'action
        // en titre, précédé côté affichage du prénom de la personne concernée
        // (« SONIA — Rappeler Mme MARTINEZ »), plutôt qu'un constat identique
        // pour tous (« Appel toujours pas traité »).
        return [
            'type' => 'appel_rappel',
            'titre' => 'Rappeler ' . ($appel->appelant_nom ?: 'le correspondant'),
            'message' => trim("Appel du {$dateCourte} non traité" . ($appel->objet ? " · « {$appel->objet} »" : '')),
            'details' => array_values(array_filter([
                "L'appel de {$appelant}{$sujet}, reçu le {$date}, n'a toujours pas été traité.",
            ])),
            'cible' => CibleNotification::pourAppel($appel, $notifiable),
            'urgence' => ['niveau' => 'urgent', 'libelle' => 'URGENT'],
            'contexte' => implode(' · ', array_filter(['Appel', $anciennete])),
            'persistante' => true,
            'tag' => "appel-{$appel->id}",
            'actions' => [
                ['action' => 'ouvrir', 'titre' => "Ouvrir l'appel", 'lien' => $lien],
                ['action' => 'reporter', 'titre' => 'Rappeler dans 1 h'],
            ],
            'lien' => $lien,
            'appel_id' => $appel->id,
        ];
    }
}
