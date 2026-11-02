<?php

namespace App\Console\Commands;

use App\Jobs\AnalyserDocumentIA;
use App\Models\DocumentArchive;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Réintègre les fichiers retrouvés manuellement pour les documents nettoyés
 * par documents:nettoyer-fichiers-perdus (chemin_stockage_serveur vidé) — la
 * référence (CRE-260804, CRS-260904...) sert de clé de correspondance, donnée
 * dans le nom de chaque fichier (ex: "CRE-260804.pdf").
 *
 * Par défaut : simulation (--confirmer non fourni) — affiche ce qui serait
 * fait, ne modifie rien. N'écrit JAMAIS sur un document qui a déjà un
 * fichier : ne remplace que les documents encore marqués "perdus"
 * (chemin_stockage_serveur null), pour ne jamais écraser un contenu valide.
 */
class RestaurerFichiersPerdus extends Command
{
    protected $signature = 'documents:restaurer-fichiers-perdus
        {dossier : Dossier contenant les fichiers PDF nommés d\'après la référence, ex. CRE-260804.pdf}
        {--confirmer : Applique réellement la restauration (sans cette option, simulation uniquement)}';

    protected $description = "Réintègre des fichiers retrouvés manuellement pour des documents dont le fichier avait été perdu, en les reliant par leur référence (CRE-/CRS-...)";

    public function handle(): int
    {
        $confirmer = $this->option('confirmer');
        $dossier = rtrim($this->argument('dossier'), '/\\');

        if (!is_dir($dossier)) {
            $this->error("Dossier introuvable : {$dossier}");
            return self::FAILURE;
        }

        $fichiers = glob("{$dossier}/*.pdf") ?: [];
        if (empty($fichiers)) {
            $this->warn("Aucun fichier .pdf trouvé dans {$dossier}.");
            return self::SUCCESS;
        }

        if (!$confirmer) {
            $this->warn('SIMULATION (aucune écriture) — relancer avec --confirmer pour appliquer réellement.');
            $this->newLine();
        }

        $restaures = 0;
        $ignores = 0;

        foreach ($fichiers as $chemin) {
            $nomFichier = basename($chemin);

            if (!preg_match('/(CRE|CRS)-(\d{6})/', $nomFichier, $m)) {
                $this->line("  {$nomFichier} → ignoré (pas de référence CRE-/CRS- reconnaissable dans le nom)");
                $ignores++;
                continue;
            }
            $reference = "{$m[1]}-{$m[2]}";

            $candidats = DocumentArchive::where('code_reference', $reference)
                ->whereNull('chemin_stockage_serveur')
                ->get(['id', 'code_reference', 'titre_document', 'categorie_id', 'type_document_id']);

            if ($candidats->isEmpty()) {
                $this->line("  {$nomFichier} → ignoré : aucun document \"{$reference}\" encore marqué comme perdu (déjà restauré, référence inconnue, ou document avec un fichier valide)");
                $ignores++;
                continue;
            }
            if ($candidats->count() > 1) {
                $ids = $candidats->pluck('id')->implode(', ');
                $this->warn("  {$nomFichier} → ignoré : {$candidats->count()} documents \"{$reference}\" sont tous marqués comme perdus (ids {$ids}) — ambigu, à traiter à la main");
                $ignores++;
                continue;
            }

            $document = $candidats->first();
            $contenu = file_get_contents($chemin);
            $taille = strlen($contenu);
            $checksum = hash('sha256', $contenu);

            $this->line("  {$nomFichier} → #{$document->id} · {$document->titre_document} : " . ($confirmer ? 'RESTAURÉ' : 'serait restauré') . " ({$this->formaterTaille($taille)})");

            if ($confirmer) {
                $dossierStockage = "categorie_{$document->categorie_id}/type_{$document->type_document_id}";
                $nomStockage = uniqid('restaure_') . '.pdf';
                $cheminStockage = "{$dossierStockage}/{$nomStockage}";

                Storage::disk(config('filesystems.document_disk'))->makeDirectory($dossierStockage);
                Storage::disk(config('filesystems.document_disk'))->put($cheminStockage, $contenu);

                $document->update([
                    'chemin_stockage_serveur' => $cheminStockage,
                    'nom_fichier_original' => $nomFichier,
                    'format_mime' => 'application/pdf',
                    'taille' => $taille,
                    'checksum_sha256' => $checksum,
                    // L'ancien texte_extrait (s'il existe) correspond au fichier
                    // qui s'affichait par erreur avant le nettoyage, pas au vrai
                    // contenu de CE document — remis à null pour qu'une analyse
                    // IA fraîche reparte du bon fichier (voir lancerAnalyseIaSiNecessaire,
                    // qui ignore les documents ayant déjà un texte_extrait non vide).
                    'texte_extrait' => null,
                ]);

                AnalyserDocumentIA::dispatch($document);
            }

            $restaures++;
        }

        $this->newLine();
        if ($confirmer) {
            $this->info("{$restaures} document(s) restauré(s), {$ignores} fichier(s) ignoré(s).");
        } else {
            $this->comment("{$restaures} document(s) seraient restaurés, {$ignores} fichier(s) seraient ignorés. Relancer avec --confirmer pour appliquer.");
        }

        return self::SUCCESS;
    }

    private function formaterTaille(int $octets): string
    {
        return $octets >= 1024 * 1024
            ? round($octets / (1024 * 1024), 1) . ' Mo'
            : round($octets / 1024, 1) . ' Ko';
    }
}
