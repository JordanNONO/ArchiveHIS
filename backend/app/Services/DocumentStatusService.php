<?php

namespace App\Services;

use App\Enums\StatutDocument;
use App\Events\DocumentStatutMisAJour;
use App\Models\DocumentArchive;
use App\Models\HistoriqueStatut;
use App\Models\Utilisateurs;
use App\Notifications\DocumentNeedsValidationNotification;
use App\Notifications\DocumentStatusChangedNotification;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class DocumentStatusService
{
    /**
     * Statuts "terminaux" d'un cycle de validation : on notifie le propriétaire du
     * document à ce moment-là, mais pas à chaque étape de routage interne
     * (ex: SOUMIS → TRANSMIS_AU_SERVICE ne concerne pas encore l'auteur).
     */
    private const STATUTS_NOTIFIANT_PROPRIETAIRE = [
        StatutDocument::VALIDE_ET_TRAITE->value,
        StatutDocument::ARCHIVE->value,
        StatutDocument::INCOMPLET_REJETE->value,
    ];

    /**
     * Fait transitionner un document vers un nouveau statut, en validant le workflow,
     * en journalisant le changement dans HistoriqueStatut, et en notifiant les
     * personnes concernées (validateurs si soumis, propriétaire si traité/rejeté).
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

        $document = DB::transaction(function () use ($document, $ancienStatut, $nouveauStatut, $motif) {
            $document->status_doc = $nouveauStatut;

            if ($nouveauStatut === StatutDocument::ARCHIVE->value) {
                $document->date_archivage = now();
            }

            $document->save();

            HistoriqueStatut::create([
                'document_archive_id' => $document->id,
                'utilisateur_id' => auth('api')->id(),
                'ancien_statut' => $ancienStatut,
                'nouveau_statut' => $nouveauStatut,
                'date_changement' => now(),
                'motif_changement' => $motif,
            ]);

            return $document;
        });

        $this->notifier($document, $nouveauStatut);
        broadcast(new DocumentStatutMisAJour($document));

        return $document;
    }

    private function notifier(DocumentArchive $document, string $nouveauStatut): void
    {
        $auteurId = auth('api')->id();

        if ($nouveauStatut === StatutDocument::SOUMIS->value) {
            $validateurs = Utilisateurs::whereHas('roles.permissions', function ($query) {
                $query->where('code_perm', 'valider_documents');
            })->where('id', '!=', $auteurId)->get();

            foreach ($validateurs as $validateur) {
                $validateur->notify(new DocumentNeedsValidationNotification($document));
            }

            return;
        }

        if (in_array($nouveauStatut, self::STATUTS_NOTIFIANT_PROPRIETAIRE, true) && $document->utilisateur_id !== $auteurId) {
            $document->utilisateur?->notify(new DocumentStatusChangedNotification($document, StatutDocument::from($nouveauStatut)));
        }
    }
}
