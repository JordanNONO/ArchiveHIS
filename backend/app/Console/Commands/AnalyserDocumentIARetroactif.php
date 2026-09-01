<?php

namespace App\Console\Commands;

use App\Jobs\AnalyserDocumentIA;
use App\Models\DocumentArchive;
use Illuminate\Console\Command;

/**
 * Rattrapage manuel (à lancer une fois via SSH, pas planifié) pour les
 * documents archivés avant l'introduction de l'analyse IA, ou déposés hors du
 * flux de scan caméra — voir AnalyserDocumentIA. Ne cible que les formats
 * réellement analysables (PDF/image) pour ne jamais enfiler puis ignorer un
 * document non supporté (ex: .docx).
 */
class AnalyserDocumentIARetroactif extends Command
{
    protected $signature = 'documents:analyser-ia-retroactif';

    protected $description = "Lance l'analyse IA (extraction de texte) sur les documents existants qui n'en ont pas encore";

    public function handle(): int
    {
        $documents = DocumentArchive::whereNull('texte_extrait')
            ->where(function ($requete) {
                $requete->where('format_mime', 'application/pdf')
                    ->orWhere('format_mime', 'like', 'image/%');
            })
            ->get();

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
