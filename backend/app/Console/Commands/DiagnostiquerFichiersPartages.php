<?php

namespace App\Console\Commands;

use App\Models\DocumentArchive;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Diagnostic en LECTURE SEULE — aucune modification. Avant la correction du
 * 2026-10-28 (voir DocumentController::store(), nomFichier basé sur un UUID
 * au lieu du titre), deux documents du même dossier avec exactement le même
 * titre (ex: "Courrier entrant — Avis d'échéance", récurrent chaque mois)
 * pouvaient se retrouver au même chemin de stockage — le second écrasait
 * silencieusement le fichier du premier sur le disque, sans erreur. Les deux
 * lignes en base gardent chacune leurs propres métadonnées (titre, référence,
 * résumé...) mais pointent vers un seul fichier : celui du plus récent des
 * deux. Liste ces groupes pour savoir lesquels ont perdu leur vrai fichier.
 */
class DiagnostiquerFichiersPartages extends Command
{
    protected $signature = 'documents:diagnostiquer-fichiers-partages';

    protected $description = "Liste les documents qui partagent (par erreur) le même fichier sur le disque à cause de l'ancien bug de nommage par titre";

    public function handle(): int
    {
        $chemins = DocumentArchive::select('chemin_stockage_serveur')
            ->whereNotNull('chemin_stockage_serveur')
            ->groupBy('chemin_stockage_serveur')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('chemin_stockage_serveur');

        if ($chemins->isEmpty()) {
            $this->info('Aucun document ne partage son fichier avec un autre — rien à signaler.');
            return self::SUCCESS;
        }

        $this->warn("{$chemins->count()} chemin(s) de stockage partagé(s) par plusieurs documents :");
        $this->newLine();

        foreach ($chemins as $chemin) {
            $documents = DocumentArchive::where('chemin_stockage_serveur', $chemin)
                ->orderBy('created_at')
                ->get(['id', 'code_reference', 'titre_document', 'created_at']);

            $this->line("Fichier : {$chemin}");
            foreach ($documents as $i => $document) {
                $estLeBon = $i === $documents->count() - 1;
                $etat = $estLeBon ? 'affiche le bon fichier (le plus récent des deux)' : 'AFFICHE EN RÉALITÉ LE FICHIER DU PLUS RÉCENT — son propre fichier original est perdu';
                $this->line("  #{$document->id} · {$document->code_reference} · {$document->titre_document} · archivé le {$document->created_at->format('d/m/Y H:i')} → {$etat}");
            }
            $this->newLine();
        }

        $this->comment("Pour un document marqué \"perdu\" : son fichier d'origine n'est récupérable que depuis une sauvegarde antérieure à la collision (voir backup:run, conservées 2 semaines), pas depuis l'application elle-même.");

        return self::SUCCESS;
    }
}
