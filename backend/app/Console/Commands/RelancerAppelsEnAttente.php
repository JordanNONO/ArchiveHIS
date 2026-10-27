<?php

namespace App\Console\Commands;

use App\Http\Controllers\AppelTelephoniqueController;
use App\Models\AppelTelephonique;
use App\Models\Utilisateurs;
use App\Notifications\AppelRappelNotification;
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

        // Même résolution d'audience qu'à la création d'un appel (voir
        // AppelTelephoniqueController::notifierPersonneConcernee()) : le(s)
        // concerné(s) d'abord, puis le reste du personnel gerer_appels.
        $controleur = app(AppelTelephoniqueController::class);

        foreach ($appels as $appel) {
            $agentId = $appel->utilisateur_id;
            $concernesIds = $controleur->utilisateursConcernesIds($appel)->reject(fn ($id) => $id === $agentId);

            foreach (Utilisateurs::whereIn('id', $concernesIds)->get() as $concerne) {
                $concerne->notify(new AppelRappelNotification($appel));
            }

            $destinataires = Utilisateurs::whereHas('roles.permissions', fn ($q) => $q->where('code_perm', 'gerer_appels'))
                ->where('id', '!=', $agentId)
                ->whereNotIn('id', $concernesIds)
                ->get();

            foreach ($destinataires as $destinataire) {
                $destinataire->notify(new AppelRappelNotification($appel));
            }

            $appel->update(['rappel_appel_envoye_le' => now()]);
        }

        $this->info("Rappels envoyés pour {$appels->count()} appel(s).");

        return self::SUCCESS;
    }
}
