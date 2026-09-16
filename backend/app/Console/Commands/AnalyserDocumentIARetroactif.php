<?php

namespace App\Console\Commands;

use App\Jobs\AnalyserDocumentIA;
use App\Models\DocumentArchive;
use App\Services\OnlyOfficeConversionService;
use Illuminate\Console\Command;

/**
 * Rattrapage (planifié chaque nuit — voir routes/console.php — en plus du
 * déclenchement automatique à chaque dépôt) pour les documents archivés avant
 * l'introduction de l'analyse IA, ou dont l'analyse a échoué ponctuellement.
 * Cible le PDF/image (lu directement par Claude) ET les formats bureautiques
 * qu'OnlyOfficeConversionService sait convertir en PDF avant analyse — voir
 * AnalyserDocumentIA::handle(). Ignore le reste (ex: .zip) pour ne jamais
 * enfiler puis silencieusement abandonner un document non analysable.
 */
class AnalyserDocumentIARetroactif extends Command
{
    protected $signature = 'documents:analyser-ia-retroactif';

    protected $description = "Lance l'analyse IA (extraction de texte) sur les documents existants qui n'en ont pas encore";

    public function handle(): int
    {
        $candidats = DocumentArchive::whereNull('texte_extrait')
            ->whereNotNull('chemin_stockage_serveur')
            ->get();

        $documents = $candidats->filter(function (DocumentArchive $document) {
            if ($document->format_mime === 'application/pdf' || str_starts_with((string) $document->format_mime, 'image/')) {
                return true;
            }
            $extension = strtolower(pathinfo($document->chemin_stockage_serveur, PATHINFO_EXTENSION));
            return OnlyOfficeConversionService::estConvertible($extension);
        });

        if ($documents->isEmpty()) {
            $this->info('Aucun document à analyser.');
            return self::SUCCESS;
        }

        foreach ($documents as $document) {
            AnalyserDocumentIA::dispatch($document);
        }

        $this->info("{$documents->count()} document(s) mis en file d'attente pour analyse IA.");

        return self::SUCCESS;
    }
}
