<?php

namespace App\Console\Commands;

use App\Models\DocumentArchive;
use App\Notifications\DelaiCorrectionDepasseNotification;
use App\Services\DestinatairesNotification;
use Illuminate\Console\Command;

/**
 * Relance (déposant + service concerné) les documents rejetés dont le délai
 * de correction de 3 jours est dépassé — voir DocumentStatusService pour la
 * pose de l'échéance au moment du rejet.
 */
class RelancerCorrectionsEnRetard extends Command
{
    protected $signature = 'corrections:relancer';

    protected $description = "Relance les documents rejetés dont le délai de correction (3 jours) est dépassé, des deux côtés (déposant et service)";

    public function handle(DestinatairesNotification $destinataires): int
    {
        $documents = DocumentArchive::where('status_doc', 'INCOMPLET_REJETE')
            ->whereNotNull('date_limite_correction')
            ->where('date_limite_correction', '<', now())
            ->whereNull('relance_correction_envoyee_le')
            ->with('categorieDocument', 'utilisateur')
            ->get();

        foreach ($documents as $document) {
            // Règle « correction_en_retard » : le déposant (texte « à vous de
            // corriger ») et les valideurs du service (texte « en attente »).
            $destinataires->envoyer(
                'correction_en_retard',
                $destinataires->contexteDocument($document),
                fn ($u, string $public) => new DelaiCorrectionDepasseNotification($document, pourDeposant: $public === 'auteur'),
            );

            $document->update(['relance_correction_envoyee_le' => now()]);
        }

        $this->info("Relances envoyées : {$documents->count()}");

        return self::SUCCESS;
    }
}
