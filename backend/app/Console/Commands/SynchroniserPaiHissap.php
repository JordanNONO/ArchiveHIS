<?php

namespace App\Console\Commands;

use App\Models\PaiDossier;
use App\Services\HissapPaiService;
use Illuminate\Console\Command;
use RuntimeException;

/**
 * Remet à jour les dossiers PAI déjà importés de HisSAP quand leur PAI y a
 * changé. N'importe jamais de nouveau dossier : ça reste un choix fait à la
 * main depuis la page PAI.
 */
class SynchroniserPaiHissap extends Command
{
    protected $signature = 'pai:synchroniser-hissap';

    protected $description = 'Met à jour les dossiers PAI importés de HisSAP';

    public function handle(HissapPaiService $service): int
    {
        if (!$service->estConfigure()) {
            return self::SUCCESS;
        }

        try {
            $pais = collect($service->recupererTous())->keyBy('client_id');
        } catch (RuntimeException $e) {
            $this->warn($e->getMessage());
            return self::FAILURE;
        }

        $misAJour = 0;
        PaiDossier::whereNotNull('hissap_client_id')->with(['creePar', 'responsableSecteur'])->get()
            ->each(function (PaiDossier $dossier) use ($pais, $service, &$misAJour) {
                $pai = $pais->get($dossier->hissap_client_id);
                if (!$pai || $service->statut($pai, $dossier) === 'a_jour') {
                    return;
                }
                $service->importer($pai, $dossier->creePar ?? $dossier->responsableSecteur);
                $misAJour++;
            });

        $this->info("$misAJour dossier(s) PAI mis à jour depuis HisSAP.");
        return self::SUCCESS;
    }
}
