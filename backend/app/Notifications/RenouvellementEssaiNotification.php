<?php

namespace App\Notifications;

use App\Models\FluctuationRh;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Rappel qu'il faut faire le renouvellement de la période d'essai d'un
 * salarié — envoyé une seule fois par entrée, 1 mois et demi après sa date
 * d'entrée (voir RelancerRenouvellementEssai, DELAI_ALERTE_JOURS), pour
 * laisser le temps de faire le renouvellement avant la fin des 2 premiers
 * mois. Un seul renouvellement possible (règle métier confirmée) : pas de
 * second rappel après celui-ci.
 */
class RenouvellementEssaiNotification extends Notification
{
    use Queueable;

    public function __construct(public FluctuationRh $ligne)
    {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        $mois = $this->ligne->date_debut->copy()->addDays(45)->format('Y-m');

        return [
            'type' => 'renouvellement_essai',
            'titre' => 'Renouvellement de la période d\'essai',
            'message' => "La période d'essai de {$this->ligne->salarie} (entré le {$this->ligne->date_debut->format('d/m/Y')}) doit être renouvelée avant la fin du mois en cours.",
            'lien' => "/fluctuation-rh?mois={$mois}",
        ];
    }
}
