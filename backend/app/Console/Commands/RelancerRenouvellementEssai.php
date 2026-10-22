<?php

namespace App\Console\Commands;

use App\Models\FluctuationRh;
use App\Models\Utilisateurs;
use App\Notifications\RenouvellementEssaiNotification;
use Illuminate\Console\Command;

/**
 * Rappelle qu'il faut faire le renouvellement de la période d'essai d'un
 * salarié — 1 mois et demi (45 jours) après sa date d'entrée (ligne "entree"
 * de la Fluctuation RH), pour laisser le temps de le faire avant la fin des
 * 2 premiers mois (règle métier confirmée : 1 seul renouvellement possible,
 * donc un seul rappel, jamais répété — voir rappel_essai_envoye_le).
 */
class RelancerRenouvellementEssai extends Command
{
    private const DELAI_ALERTE_JOURS = 45;

    protected $signature = 'fluctuationRh:relancer-essai';

    protected $description = "Rappelle le renouvellement de la période d'essai, 1 mois et demi après la date d'entrée d'un salarié";

    public function handle(): int
    {
        $lignes = FluctuationRh::where('section', 'entree')
            ->whereNotNull('date_debut')
            ->whereNull('rappel_essai_envoye_le')
            ->get()
            ->filter(fn (FluctuationRh $ligne) => $ligne->date_debut->copy()->addDays(self::DELAI_ALERTE_JOURS)->isPast())
            // Ne jamais déclencher sur une entrée trop ancienne (donnée
            // historique jamais passée par cette commande avant son ajout,
            // import rétroactif...) — passé la fin des 2 premiers mois, le
            // rappel n'a plus de sens (retour utilisateur : "juste les plus
            // récents, pas toute l'année"). Même borne que
            // FluctuationRhController::compteurs().
            ->filter(fn (FluctuationRh $ligne) => $ligne->date_debut->copy()->addMonths(2)->isFuture());

        if ($lignes->isEmpty()) {
            $this->info('Aucun renouvellement de période d\'essai à signaler.');
            return self::SUCCESS;
        }

        // Même audience que la Fluctuation RH elle-même (voir Sidebar.jsx :
        // isAdministrator || hasPermission('gerer_fluctuation_rh')).
        $destinataires = Utilisateurs::whereHas('roles', function ($requete) {
            $requete->whereIn('nom', ['Administrator', 'Super Administrateur'])
                ->orWhereHas('permissions', fn ($q) => $q->where('code_perm', 'gerer_fluctuation_rh'));
        })->get();

        foreach ($lignes as $ligne) {
            foreach ($destinataires as $destinataire) {
                $destinataire->notify(new RenouvellementEssaiNotification($ligne));
            }
            $ligne->update(['rappel_essai_envoye_le' => now()]);
        }

        $this->info("Rappels envoyés pour {$lignes->count()} entrée(s), à {$destinataires->count()} destinataire(s).");

        return self::SUCCESS;
    }
}
