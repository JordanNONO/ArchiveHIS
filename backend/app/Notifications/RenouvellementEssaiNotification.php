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

        // Une seule phrase naturelle plutôt que des fragments empilés (motif/
        // observations) — retour utilisateur : le "qui"/"quand" doit se lire
        // directement, pas se reconstituer à partir de plusieurs lignes.
        return [
            'type' => 'renouvellement_essai',
            'titre' => "Renouvellement d'essai à faire — {$ligne->salarie}",
            'message' => "La période d'essai de {$ligne->salarie} (entré le {$ligne->date_debut->format('d/m/Y')}) doit être renouvelée avant le {$limite}.",
            'personne_concernee' => $ligne->salarie,
            'lien' => "/fluctuation-rh?mois={$mois}&ligne={$ligne->id}",
            'fluctuation_id' => $ligne->id,
        ];
    }
}
