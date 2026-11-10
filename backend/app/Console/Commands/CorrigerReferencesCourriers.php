<?php

namespace App\Console\Commands;

use App\Models\CourrierCompteur;
use App\Models\DocumentArchive;
use Illuminate\Console\Command;

/**
 * Redonne une référence dans le bon mois aux courriers dont la date a été
 * corrigée après l'enregistrement (avant que DocumentController::update() ne
 * recalcule la référence) — ex : un sortant du 05/11 resté en CRS-261012.
 *
 * Les nouveaux numéros sont pris via CourrierCompteur::genererReference(),
 * donc à la suite du compteur du bon mois : aucun doublon possible avec les
 * courriers déjà référencés ni avec ceux enregistrés ensuite. Traités dans
 * l'ordre chronologique de leur date, pour que la numérotation suive l'ordre
 * du registre.
 *
 * Par défaut : simulation (aucune écriture) — relancer avec --confirmer.
 * Les anciens numéros libérés ne sont pas réutilisés (trous dans la série
 * de l'ancien mois), comme un numéro barré dans un registre papier.
 */
class CorrigerReferencesCourriers extends Command
{
    protected $signature = 'courriers:corriger-references
        {--confirmer : Applique réellement la correction (sans cette option, simulation uniquement)}';

    protected $description = "Renumérote les courriers dont la référence (CRE-/CRS-AAMMNN) ne correspond pas au mois de leur date";

    public function handle(): int
    {
        $confirmer = $this->option('confirmer');

        $aCorriger = DocumentArchive::whereNotNull('sens_courrier')
            ->whereNotNull('code_reference')
            ->get()
            ->filter(fn ($c) => CourrierCompteur::referenceDecalee($c->code_reference, $this->dateDe($c)))
            ->sortBy(fn ($c) => $this->dateDe($c)->format('Y-m-d') . sprintf('%010d', $c->id))
            ->values();

        if ($aCorriger->isEmpty()) {
            $this->info('Aucune référence décalée : tout est correct.');
            return self::SUCCESS;
        }

        if (!$confirmer) {
            $this->warn('SIMULATION (aucune écriture) — relancer avec --confirmer pour appliquer réellement.');
            $this->newLine();
        }

        $lignes = [];
        foreach ($aCorriger as $courrier) {
            $ancienne = $courrier->code_reference;
            $date = $this->dateDe($courrier);

            if ($confirmer) {
                $nouvelle = CourrierCompteur::genererReference($courrier->sens_courrier, $date);
                $courrier->update([
                    'code_reference' => $nouvelle,
                    'titre_document' => str_replace($ancienne, $nouvelle, $courrier->titre_document),
                ]);
            } else {
                $nouvelle = '(prochain numéro ' . ($courrier->sens_courrier === 'entrant' ? 'CRE' : 'CRS') . '-' . $date->format('ym') . 'xx)';
            }

            $lignes[] = [$courrier->id, $courrier->sens_courrier, $date->format('d/m/Y'), $ancienne, $nouvelle];
        }

        $this->table(['id', 'sens', 'date', 'ancienne référence', 'nouvelle référence'], $lignes);
        $this->info(($confirmer ? 'Corrigés : ' : 'À corriger : ') . count($lignes));

        return self::SUCCESS;
    }

    private function dateDe(DocumentArchive $courrier)
    {
        return $courrier->sens_courrier === 'entrant' ? $courrier->date_reception : $courrier->date_envoi;
    }
}
