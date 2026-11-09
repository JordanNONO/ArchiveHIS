<?php

namespace App\Console\Commands;

use App\Models\DocumentArchive;
use App\Notifications\CourrierRappelNotification;
use App\Services\DestinatairesNotification;
use Illuminate\Console\Command;

/**
 * Rappelle les courriers entrants toujours "En attente" — soit leur deadline
 * est dépassée, soit ils traînent depuis plus de 7 jours sans deadline
 * précisée (voir CourrierForm.jsx). Réservé aux Administrateurs et au
 * personnel du service Administratif (pas tout le monde, contrairement à
 * corrections:relancer) — c'est ce service qui gère les courriers au
 * quotidien, voir CategorieDocumentSeeder / ServiceMetierSeeder.
 */
class RelancerCourriersEnAttente extends Command
{
    private const JOURS_SANS_DEADLINE = 7;

    protected $signature = 'courriers:relancer';

    protected $description = "Rappelle les courriers entrants en attente dont la deadline est dépassée, ou qui traînent depuis plus de 7 jours sans deadline";

    public function handle(): int
    {
        $documents = DocumentArchive::where('sens_courrier', 'entrant')
            ->where('etat_courrier', 'En attente')
            ->whereNull('rappel_courrier_envoye_le')
            ->where(function ($requete) {
                $requete->where('deadline_courrier', '<', now())
                    ->orWhere(function ($sansDeadline) {
                        $sansDeadline->whereNull('deadline_courrier')
                            ->where('created_at', '<', now()->subDays(self::JOURS_SANS_DEADLINE));
                    });
            })
            ->get();

        if ($documents->isEmpty()) {
            $this->info('Aucun courrier à relancer.');
            return self::SUCCESS;
        }

        // Règle « courrier » de config/notifications_destinataires.php.
        $destinataires = app(DestinatairesNotification::class);
        $total = 0;

        foreach ($documents as $document) {
            $deadlineDepassee = (bool) ($document->deadline_courrier && $document->deadline_courrier->isPast());

            $total += $destinataires->envoyer(
                'courrier',
                $destinataires->contexteCourrier($document),
                fn () => new CourrierRappelNotification($document, $deadlineDepassee),
            );

            $document->update(['rappel_courrier_envoye_le' => now()]);
        }

        $this->info("Rappels envoyés pour {$documents->count()} courrier(s), soit {$total} notification(s).");

        return self::SUCCESS;
    }
}
