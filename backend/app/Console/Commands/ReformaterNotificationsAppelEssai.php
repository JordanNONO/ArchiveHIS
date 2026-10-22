<?php

namespace App\Console\Commands;

use App\Models\AppelTelephonique;
use App\Models\FluctuationRh;
use App\Notifications\AppelTelephoniqueNotification;
use App\Notifications\RenouvellementEssaiNotification;
use Illuminate\Console\Command;
use Illuminate\Notifications\DatabaseNotification;

/**
 * Commande à usage unique (retour utilisateur : "tu dois tout changer même
 * les précédentes") — AppelTelephoniqueNotification/RenouvellementEssaiNotification
 * ont été reformulées en phrases naturelles, mais Laravel enregistre le
 * résultat de toArray() tel quel au moment de l'envoi : les notifications déjà
 * en base restaient affichées avec l'ancien texte en fragments tant qu'on ne
 * les régénère pas explicitement. Reconstruit le texte depuis l'appel/la
 * ligne de fluctuation encore vivants en base — sans ré-envoyer ni rouvrir
 * ces notifications (juste leur texte stocké qui change).
 */
class ReformaterNotificationsAppelEssai extends Command
{
    protected $signature = 'notifications:reformater-appels-essai';

    protected $description = "Régénère le texte des notifications d'appel et de renouvellement d'essai déjà en base, avec la nouvelle formulation";

    public function handle(): int
    {
        $compteurAppels = 0;
        DatabaseNotification::where('type', AppelTelephoniqueNotification::class)
            ->chunkById(100, function ($notifications) use (&$compteurAppels) {
                foreach ($notifications as $notification) {
                    $appel = AppelTelephonique::with('utilisateur')->find($notification->data['appel_id'] ?? null);
                    if (!$appel || !$appel->utilisateur) {
                        continue;
                    }
                    // expediteur_id n'était rempli que pour estPersonneConcernee=true
                    // (voir AppelTelephoniqueNotification::toArray()) — seul indice
                    // encore disponible pour reconstruire ce drapeau après coup.
                    $estPersonneConcernee = !empty($notification->data['expediteur_id']);
                    $nouvelle = (new AppelTelephoniqueNotification($appel, $appel->utilisateur->nom, $estPersonneConcernee))->toArray(null);
                    $notification->forceFill(['data' => $nouvelle])->save();
                    $compteurAppels++;
                }
            });

        $compteurEssai = 0;
        DatabaseNotification::where('type', RenouvellementEssaiNotification::class)
            ->chunkById(100, function ($notifications) use (&$compteurEssai) {
                foreach ($notifications as $notification) {
                    $ligne = FluctuationRh::find($notification->data['fluctuation_id'] ?? null);
                    if (!$ligne) {
                        continue;
                    }
                    $nouvelle = (new RenouvellementEssaiNotification($ligne))->toArray(null);
                    $notification->forceFill(['data' => $nouvelle])->save();
                    $compteurEssai++;
                }
            });

        $this->info("Notifications d'appel reformatées : {$compteurAppels}. Renouvellements d'essai reformatés : {$compteurEssai}.");

        return self::SUCCESS;
    }
}
