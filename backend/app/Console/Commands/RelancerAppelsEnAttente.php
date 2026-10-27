<?php

namespace App\Console\Commands;

use App\Http\Controllers\AppelTelephoniqueController;
use App\Models\AppelTelephonique;
use App\Models\Utilisateurs;
use App\Notifications\AppelRappelNotification;
use Illuminate\Console\Command;

/**
 * Rappelle les appels toujours "non traités" (traite_le vide) depuis plus de
 * 7 jours — même principe que RelancerCourriersEnAttente, demande explicite
 * ("ajoute aussi la relance côté appel comme les courriers"). Un appel n'a
 * pas de deadline comme un courrier : seul le délai de 7 jours s'applique ici.
 */
class RelancerAppelsEnAttente extends Command
{
    private const JOURS_SANS_TRAITEMENT = 7;

    protected $signature = 'appels:relancer';

    protected $description = "Rappelle les appels toujours non traités depuis plus de 7 jours";

    public function handle(): int
    {
        $appels = AppelTelephonique::with('utilisateur')
            ->whereNull('traite_le')
            ->whereNull('rappel_appel_envoye_le')
            ->where('created_at', '<', now()->subDays(self::JOURS_SANS_TRAITEMENT))
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
