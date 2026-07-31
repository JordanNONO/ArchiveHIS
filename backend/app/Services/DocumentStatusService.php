<?php

namespace App\Services;

use App\Enums\StatutDocument;
use App\Events\DocumentStatutMisAJour;
use App\Models\DocumentArchive;
use App\Models\HistoriqueStatut;
use App\Models\SuiviDelai;
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

            // Délai de correction (3 jours) : posé au moment du rejet, effacé dès que
            // le document quitte ce statut (corrigé et renvoyé, ou toute autre
            // transition) — voir la commande planifiée corrections:relancer.
            if ($nouveauStatut === StatutDocument::INCOMPLET_REJETE->value) {
                $document->date_limite_correction = now()->addDays(3);
                $document->relance_correction_envoyee_le = null;
            } elseif ($ancienStatut === StatutDocument::INCOMPLET_REJETE->value) {
                $document->date_limite_correction = null;
            }

            $document->save();

            // "Clôture & Archivage" du suivi de délai (voir SuiviDelai) : l'archivage du
            // document clôt de facto toute procédure à échéance encore ouverte dessus,
            // il n'y a plus rien à surveiller une fois le dossier classé.
            if ($nouveauStatut === StatutDocument::ARCHIVE->value) {
                SuiviDelai::where('document_declencheur_id', $document->id)
                    ->whereNull('termine_le')
                    ->update(['termine_le' => now()]);
            }

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
            $this->notifierValidateurs($document, $auteurId);
            return;
        }

        if (in_array($nouveauStatut, self::STATUTS_NOTIFIANT_PROPRIETAIRE, true) && $document->utilisateur_id !== $auteurId) {
            $document->utilisateur?->notify(new DocumentStatusChangedNotification($document, StatutDocument::from($nouveauStatut)));
        }
    }

    /**
     * Notifie les validateurs qu'un document attend leur action — appelé à la fois
     * lors d'une transition vers SOUMIS (resoumission après rejet) et directement à
     * la création (voir DocumentController::store()), puisqu'un document archivé
     * n'a plus d'étape "brouillon" intermédiaire : il est soumis dès son dépôt.
     */
    public function notifierValidateurs(DocumentArchive $document, ?int $excluUtilisateurId = null): void
    {
        foreach ($this->validateursDuService($document, $excluUtilisateurId ?? auth('api')->id()) as $validateur) {
            $validateur->notify(new DocumentNeedsValidationNotification($document));
        }
    }

    /**
     * Les validateurs du service propriétaire d'un document (via sa catégorie) —
     * partagé entre notifierValidateurs() et la commande planifiée
     * corrections:relancer, qui a besoin de la même liste pour la relance
     * "côté interne".
     */
    public function validateursDuService(DocumentArchive $document, ?int $excluUtilisateurId = null)
    {
        $serviceMetierId = $document->categorieDocument?->service_metier_id;

        $requete = Utilisateurs::query();
        if ($excluUtilisateurId) {
            $requete->where('id', '!=', $excluUtilisateurId);
        }

        if ($serviceMetierId) {
            // Ne notifie que les validateurs du service propriétaire du document
            // (ex: RH pour un dépôt d'intervenant/bénéficiaire) — pas
            // l'administrateur ni les validateurs d'un autre service, qui n'ont
            // rien à faire de ce document précis. Sans service défini sur la
            // catégorie (cas résiduel), on retombe sur l'ancien comportement
            // large plutôt que de ne notifier personne.
            $requete->whereHas('roles', function ($query) use ($serviceMetierId) {
                $query->where('service_metier_id', $serviceMetierId)
                    ->whereHas('permissions', fn ($q) => $q->where('code_perm', 'valider_documents'));
            });
        } else {
            $requete->whereHas('roles.permissions', fn ($q) => $q->where('code_perm', 'valider_documents'));
        }

        return $requete->get();
    }
}
