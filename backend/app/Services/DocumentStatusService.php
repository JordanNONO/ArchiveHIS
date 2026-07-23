<?php

namespace App\Services;

use App\Enums\StatutDocument;
use App\Models\DocumentArchive;
use App\Models\HistoriqueStatut;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class DocumentStatusService
{
    /**
     * Fait transitionner un document vers un nouveau statut, en validant le workflow
     * et en journalisant le changement dans HistoriqueStatut.
     */
    public function transitionTo(DocumentArchive $document, string $nouveauStatut, ?string $motif = null): DocumentArchive
    {
        $statutsValides = array_map(fn ($case) => $case->value, StatutDocument::cases());
        if (!in_array($nouveauStatut, $statutsValides, true)) {
            throw new InvalidArgumentException("Statut inconnu: {$nouveauStatut}");
        }

        $ancienStatut = $document->status_doc;

        if (!StatutDocument::peutTransitionerVers($ancienStatut, $nouveauStatut)) {
            throw new InvalidArgumentException("Transition non autorisée: {$ancienStatut} → {$nouveauStatut}");
        }

        return DB::transaction(function () use ($document, $ancienStatut, $nouveauStatut, $motif) {
            $document->status_doc = $nouveauStatut;

            if ($nouveauStatut === StatutDocument::ARCHIVE->value) {
                $document->date_archivage = now();
            }

            $document->save();

            HistoriqueStatut::create([
                'document_archive_id' => $document->id,
                'ancien_statut' => $ancienStatut,
                'nouveau_statut' => $nouveauStatut,
                'date_changement' => now(),
                'motif_changement' => $motif,
            ]);

            return $document;
        });
    }
}
