<?php

namespace App\Console\Commands;

use App\Models\AppelTelephonique;
use App\Notifications\AppelRappelNotification;
use App\Services\DestinatairesNotification;
use Illuminate\Console\Command;

/**
 * Rappelle les appels toujours "non traités" (traite_le vide) depuis plus de
 * 4h — même principe que RelancerCourriersEnAttente, demande explicite
 * ("ajoute aussi la relance côté appel comme les courriers"). 4h et pas 7
 * jours comme un courrier (demande explicite) : un appel reste bien plus
 * urgent à rappeler qu'un courrier à traiter.
 */
class RelancerAppelsEnAttente extends Command
{
    private const HEURES_SANS_TRAITEMENT = 4;

    protected $signature = 'appels:relancer';

    protected $description = "Rappelle les appels toujours non traités depuis plus de 4h";

    public function handle(): int
    {
        $appels = AppelTelephonique::with('utilisateur')
            ->whereNull('traite_le')
            ->whereNull('rappel_appel_envoye_le')
            ->where('created_at', '<', now()->subHours(self::HEURES_SANS_TRAITEMENT))
            ->get();

        if ($appels->isEmpty()) {
            $this->info('Aucun appel à relancer.');
            return self::SUCCESS;
        }

        // Règle « appel_rappel » de config/notifications_destinataires.php :
        // les concernés + l'agent qui a pris l'appel (équipe appels en secours).
        $destinataires = app(DestinatairesNotification::class);

        foreach ($appels as $appel) {
            $destinataires->envoyer(
                'appel_rappel',
                $destinataires->contexteAppel($appel),
                fn () => new AppelRappelNotification($appel),
            );

            $appel->update(['rappel_appel_envoye_le' => now()]);
        }

        $this->info("Rappels envoyés pour {$appels->count()} appel(s).");

        return self::SUCCESS;
    }
}
