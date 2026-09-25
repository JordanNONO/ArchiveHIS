<?php

namespace App\Console\Commands;

use App\Models\Utilisateurs;
use App\Notifications\InactiviteImminenteNotification;
use Illuminate\Console\Command;

class AlerterInactiviteImminente extends Command
{
    protected $signature = 'inactivite:alerter';

    protected $description = "Avertit (notification systeme) le personnel interne dont la session va se fermer automatiquement dans 2 minutes faute d'activite";

    /**
     * Couvre le cas ou le navigateur est ferme (ou l'ordinateur en veille) —
     * voir AuthPersonnelMiddleware, qui applique le meme seuil de 120 min pour
     * rejeter le jeton au retour. Une fenetre de 118-119 min, large d'exactement
     * une minute pour matcher l'intervalle du scheduler (everyMinute) : chaque
     * utilisateur y passe une fois et une seule, pas besoin d'une colonne
     * "deja notifie" pour eviter les doublons.
     */
    public function handle(): int
    {
        $utilisateurs = Utilisateurs::whereNotNull('dernier_vu_le')
            ->whereBetween('dernier_vu_le', [now()->subMinutes(119), now()->subMinutes(118)])
            ->get()
            ->reject(fn (Utilisateurs $u) => $u->estExempteDeconnexionAutomatique());

        foreach ($utilisateurs as $utilisateur) {
            $utilisateur->notify(new InactiviteImminenteNotification());
        }

        return self::SUCCESS;
    }
}
