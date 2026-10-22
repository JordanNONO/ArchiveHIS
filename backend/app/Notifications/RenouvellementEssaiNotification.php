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
        $ligne = $this->ligne;
        // Le mois de la ligne elle-même (pas date_debut + 45 j) : c'est dans
        // ce tableau mensuel qu'elle se trouve, et `ligne` permet à la page de
        // défiler jusqu'à elle et de la surligner, comme pour les appels.
        $mois = ($ligne->mois ?? $ligne->date_debut)->format('Y-m');
        $limite = $ligne->date_debut->copy()->addMonths(2)->format('d/m/Y');

        return [
            'type' => 'renouvellement_essai',
            'titre' => "{$ligne->salarie} — renouvellement de période d'essai",
            'message' => "La période d'essai de {$ligne->salarie} (entré le {$ligne->date_debut->format('d/m/Y')}) doit être renouvelée avant la fin du mois en cours.",
            'details' => array_values(array_filter([
                "Entrée le {$ligne->date_debut->format('d/m/Y')} · à renouveler avant le {$limite}",
                $ligne->motif ? "Motif : {$ligne->motif}" : null,
                $ligne->observations ? 'Observations : ' . \Illuminate\Support\Str::limit($ligne->observations, 140) : null,
            ])),
            'personne_concernee' => $ligne->salarie,
            'lien' => "/fluctuation-rh?mois={$mois}&ligne={$ligne->id}",
            'fluctuation_id' => $ligne->id,
        ];
    }
}
