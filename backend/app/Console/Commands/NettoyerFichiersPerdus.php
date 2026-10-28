<?php

namespace App\Console\Commands;

use App\Models\DocumentArchive;
use Illuminate\Console\Command;

/**
 * Suite à documents:diagnostiquer-fichiers-partages (bug d'écrasement par
 * titre, corrigé le 2026-10-28) : pour chaque fichier partagé par erreur par
 * plusieurs documents, le document le plus ANCIEN de chaque groupe affiche en
 * réalité le fichier du plus récent — son propre fichier original est perdu,
 * sans sauvegarde applicative possible (documents stockés sur SFTP, hors du
 * périmètre de backup:run). Le laisser pointer vers ce fichier revient à
 * continuer d'afficher silencieusement un document qui n'est pas le bon.
 *
 * Cette commande ne récupère rien — elle arrête seulement d'afficher le
 * mauvais fichier : elle vide chemin_stockage_serveur (+ nom_fichier_original,
 * format_mime, taille, checksum_sha256) sur chaque document "perdu" de chaque
 * groupe, pour que l'application affiche clairement "fichier manquant, à
 * réarchiver" (voir le garde-fou ajouté à DocumentController::show()) au lieu
 * du contenu d'un autre document.
 *
 * Par défaut : simulation (--confirmer non fourni) — affiche ce qui serait
 * fait, ne modifie rien. Nécessite --confirmer pour écrire réellement.
 */
class NettoyerFichiersPerdus extends Command
{
    protected $signature = 'documents:nettoyer-fichiers-perdus {--confirmer : Applique réellement le nettoyage (sans cette option, simulation uniquement)}';

    protected $description = "Vide la référence de fichier des documents dont le fichier d'origine a été écrasé par un autre document (voir documents:diagnostiquer-fichiers-partages)";

    public function handle(): int
    {
        $confirmer = $this->option('confirmer');

        $chemins = DocumentArchive::select('chemin_stockage_serveur')
            ->whereNotNull('chemin_stockage_serveur')
            ->groupBy('chemin_stockage_serveur')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('chemin_stockage_serveur');

        if ($chemins->isEmpty()) {
            $this->info('Aucun document ne partage son fichier avec un autre — rien à nettoyer.');
            return self::SUCCESS;
        }

        if (!$confirmer) {
            $this->warn('SIMULATION (aucune écriture) — relancer avec --confirmer pour appliquer réellement.');
            $this->newLine();
        }

        $totalNettoyes = 0;

        foreach ($chemins as $chemin) {
            $documents = DocumentArchive::where('chemin_stockage_serveur', $chemin)
                ->orderBy('created_at')
                ->get(['id', 'code_reference', 'titre_document', 'created_at']);

            $this->line("Fichier : {$chemin}");

            foreach ($documents as $i => $document) {
                $estLeBon = $i === $documents->count() - 1;

                if ($estLeBon) {
                    $this->line("  #{$document->id} · {$document->code_reference} · {$document->titre_document} → conservé (fichier correct)");
                    continue;
                }

                $this->line("  #{$document->id} · {$document->code_reference} · {$document->titre_document} → " . ($confirmer ? 'NETTOYÉ (fichier perdu)' : 'serait nettoyé (fichier perdu)'));

                if ($confirmer) {
                    // format_mime est NOT NULL sur document_archives (contrairement
                    // à document_versions/document_pieces_jointes) — on le laisse tel
                    // quel, ça ne sert plus à rien une fois chemin_stockage_serveur
                    // vide (show() refuse d'afficher le fichier avant même de le lire).
                    DocumentArchive::whereKey($document->id)->update([
                        'chemin_stockage_serveur' => null,
                        'nom_fichier_original' => null,
                        'taille' => null,
                        'checksum_sha256' => null,
                    ]);
                }

                $totalNettoyes++;
            }

            $this->newLine();
        }

        if ($confirmer) {
            $this->info("{$totalNettoyes} document(s) nettoyé(s) — ils affichent maintenant \"fichier manquant\" au lieu du fichier d'un autre document. Leur contenu d'origine reste à réarchiver manuellement.");
        } else {
            $this->comment("{$totalNettoyes} document(s) seraient nettoyés. Relancer avec --confirmer pour appliquer.");
        }

        return self::SUCCESS;
    }
}
