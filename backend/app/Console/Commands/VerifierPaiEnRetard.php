<?php

namespace App\Console\Commands;

use App\Models\PaiDossier;
use App\Models\PaiObjectif;
use App\Models\Utilisateurs;
use App\Notifications\PaiObjectifEnRetardNotification;
use App\Notifications\PaiObjectifEscaladeNotification;
use App\Notifications\PaiObjectifRappelNotification;
use Illuminate\Console\Command;

/**
 * Triple alerte des objectifs de PAI — voir la réunion qualité du 2026-08-16 :
 * "est-ce qu'on a réalisé ces 50 points à l'année ? Non, et ça remonte en
 * alerte." et le besoin explicite d'une alerte proactive (avant l'échéance),
 * pas seulement réactive.
 *
 * 1. Rappel (J-3 avant échéance) au responsable de secteur.
 * 2. Alerte de retard (échéance dépassée) au responsable de secteur.
 * 3. Escalade vers l'administration si le retard persiste sans action
 *    JOURS_AVANT_ESCALADE jours après l'alerte.
 *
 * Une seule notification par dossier et par palier (pas une par objectif),
 * comme le fait déjà l'alerte de retard historique.
 */
class VerifierPaiEnRetard extends Command
{
    protected $signature = 'pai:verifier-retard';

    protected $description = "Envoie les rappels, alertes de retard et escalades des objectifs de PAI";

    public function handle(): int
    {
        $dossiers = PaiDossier::whereNull('date_cloture')
            ->with(['objectifs', 'responsableSecteur'])
            ->get();

        $totalRappels = 0;
        $totalAlertes = 0;
        $totalEscalades = 0;
        $administrateurs = null;

        foreach ($dossiers as $dossier) {
            $objectifsActifs = $dossier->objectifs->where('fait', false);

            $aRappeler = $objectifsActifs->filter(fn (PaiObjectif $o) => $o->necessiteRappel());
            if ($aRappeler->isNotEmpty() && $dossier->responsableSecteur) {
                $dossier->responsableSecteur->notify(
                    new PaiObjectifRappelNotification($dossier, $aRappeler->count())
                );
                $totalRappels++;
                foreach ($aRappeler as $objectif) {
                    $objectif->update(['rappel_envoye_le' => now()]);
                }
            }

            $aAlerter = $objectifsActifs->filter(
                fn (PaiObjectif $o) => $o->estEnRetard() && $o->alerte_envoyee_le === null
            );
            if ($aAlerter->isNotEmpty() && $dossier->responsableSecteur) {
                $dossier->responsableSecteur->notify(
                    new PaiObjectifEnRetardNotification($dossier, $aAlerter->count())
                );
                $totalAlertes++;
                foreach ($aAlerter as $objectif) {
                    $objectif->update(['alerte_envoyee_le' => now()]);
                }
            }

            $aEscalader = $objectifsActifs->filter(fn (PaiObjectif $o) => $o->necessiteEscalade());
            if ($aEscalader->isNotEmpty()) {
                $administrateurs ??= Utilisateurs::whereHas('roles', fn ($q) => $q->where('nom', 'Administrator'))->get();

                foreach ($administrateurs as $admin) {
                    $admin->notify(new PaiObjectifEscaladeNotification($dossier, $aEscalader->count()));
                }
                $totalEscalades++;
                foreach ($aEscalader as $objectif) {
                    $objectif->update(['escalade_envoyee_le' => now()]);
                }
            }
        }

        $this->info("Dossiers PAI — rappels: {$totalRappels}, alertes: {$totalAlertes}, escalades: {$totalEscalades}");

        return self::SUCCESS;
    }
}
