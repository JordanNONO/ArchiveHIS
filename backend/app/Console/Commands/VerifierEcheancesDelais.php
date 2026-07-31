<?php

namespace App\Console\Commands;

use App\Enums\NiveauAlerte;
use App\Models\SuiviDelai;
use App\Models\Utilisateurs;
use App\Notifications\DelaiDepasseNotification;
use Illuminate\Console\Command;

class VerifierEcheancesDelais extends Command
{
    protected $signature = 'delais:verifier';

    protected $description = "Recalcule le niveau d'alerte (vert/orange/rouge) de chaque suivi de délai actif, et notifie la direction au premier passage au rouge";

    public function handle(): int
    {
        $suivis = SuiviDelai::whereNull('termine_le')->with('etapeWorkflow')->get();

        $administrateurs = Utilisateurs::whereHas('roles', fn ($q) => $q->where('nom', 'Administrator'))->get();

        $compteurs = ['VERT' => 0, 'ORANGE' => 0, 'ROUGE' => 0];

        foreach ($suivis as $suivi) {
            $nouveauNiveau = $suivi->niveauAlerteCourant();
            $compteurs[$nouveauNiveau->value]++;

            $vientDePasserAuRouge = $nouveauNiveau === NiveauAlerte::ROUGE && $suivi->manager_notifie_le === null;

            $suivi->niveau_alerte = $nouveauNiveau->value;

            if ($vientDePasserAuRouge) {
                $suivi->manager_notifie_le = now();

                foreach ($administrateurs as $admin) {
                    $admin->notify(new DelaiDepasseNotification($suivi));
                }
            }

            $suivi->save();
        }

        $this->info("Suivis vérifiés: {$suivis->count()} (vert={$compteurs['VERT']}, orange={$compteurs['ORANGE']}, rouge={$compteurs['ROUGE']})");

        return self::SUCCESS;
    }
}
