<?php

namespace App\Services;

use App\Enums\StatutDocument;
use App\Events\DocumentStatutMisAJour;
use App\Models\DocumentArchive;
use App\Models\HistoriqueStatut;
use App\Models\SuiviDelai;
use App\Models\Utilisateurs;
use App\Notifications\DocumentArchiveInfoNotification;
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
     * Notifie tout le personnel interne qu'un nouveau document a été déposé —
     * appelé à la fois lors d'une transition vers SOUMIS (resoumission après
     * rejet) et directement à la création (voir DocumentController::store()),
     * puisqu'un document archivé n'a plus d'étape "brouillon" intermédiaire :
     * il est soumis dès son dépôt.
     *
     * Volontairement PAS restreint au service propriétaire (contrairement à
     * validateursDuService() ci-dessous, toujours utilisé pour les relances
     * ciblées) : être informé ne veut pas dire pouvoir traiter — le droit de
     * validation reste gouverné par la permission valider_documents (scopée au
     * service). Mais tout le personnel doit avoir la même information, même
     * s'il ne peut pas tous agir dessus (ex: un responsable secteur, rattaché
     * aux dossiers bénéficiaires/intervenants, peut traiter une réclamation
     * qu'un chargé de com. verra passer sans pouvoir y toucher).
     */
    /**
     * `destinatairesIds`, s'il est fourni, restreint la notification à cette
     * liste précise plutôt qu'à tout le personnel interne — utilisé pour
     * l'archivage manuel (voir DocumentController::store()), où l'archiviste
     * peut choisir de n'avertir que 2-3 personnes précises plutôt que tout
     * le monde.
     */
    public function notifierValidateurs(DocumentArchive $document, ?int $excluUtilisateurId = null, ?array $destinatairesIds = null, bool $dejaTraite = false): void
    {
        // is_null(), pas une simple vérité : un tableau VIDE ([]) veut dire
        // "personne", au sens strict, distinct de "non précisé" (null) qui
        // retombe sur le personnel du service — un simple `$destinatairesIds
        // ?` traiterait [] comme faux et notifierait tout le monde par erreur.
        $destinataires = is_null($destinatairesIds)
            ? $this->personnelInterne($excluUtilisateurId ?? auth('api')->id())
            : Utilisateurs::whereIn('id', $destinatairesIds)->get();

        foreach ($destinataires as $destinataire) {
            // "Déjà traité" : rien à valider, une notification "à valider" serait
            // trompeuse — on prévient juste que le document existe (voir
            // DocumentController::store()).
            $destinataire->notify($dejaTraite
                ? new DocumentArchiveInfoNotification($document)
                : new DocumentNeedsValidationNotification($document));
        }
    }

    /**
     * Tout le personnel interne (comptes internes, hors intervenant/bénéficiaire
     * qui sont de simples comptes de dépôt) — voir Utilisateurs::estCompteDepot().
     */
    private function personnelInterne(?int $excluUtilisateurId = null)
    {
        $requete = Utilisateurs::query()->whereDoesntHave('roles', function ($q) {
            $q->whereIn('nom', ['Intervenant', 'Beneficiaire']);
        });
        if ($excluUtilisateurId) {
            $requete->where('id', '!=', $excluUtilisateurId);
        }

        return $requete->get();
    }

    /**
     * Un utilisateur a-t-il le droit de faire évoluer le statut de CE document
     * précis — contrairement à la visibilité (voir VisibiliteDocumentService,
     * ouverte à tout le personnel interne), le droit de traiter reste scopé au
     * service propriétaire (ou transverse/admin) : voir les documents des
     * autres services ne veut pas dire pouvoir les valider/rejeter à leur
     * place. Appelé par DocumentController::transition()/decisionConges()/
     * decisionPaie(), en plus (pas à la place) de la vérification de visibilité.
     */
    public function peutValider(DocumentArchive $document, Utilisateurs $utilisateur): bool
    {
        if ($utilisateur->estAdministrateur()) {
            return true;
        }

        return $this->validateursDuService($document)->contains('id', $utilisateur->id);
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
            // Notifie les validateurs du service propriétaire du document (ex: RH
            // pour un dépôt d'intervenant/bénéficiaire), ET les rôles transverses
            // (Administrator, Editor de base...) dont le `service_metier_id` est
            // NULL — ce champ NULL signifie justement "tous services" partout
            // ailleurs dans l'app (voir VisibiliteDocumentService), il doit se
            // comporter pareil ici : un administrateur qui ne reçoit jamais aucune
            // notification n'a plus la visibilité qu'on lui garantit par ailleurs.
            $requete->whereHas('roles', function ($query) use ($serviceMetierId) {
                $query->where(function ($q) use ($serviceMetierId) {
                    $q->where('service_metier_id', $serviceMetierId)
                        // Transverse (NULL) = tous les services, SAUF celui que ce rôle
                        // exclut explicitement (ex: "Responsable Secteur" qui valide tout
                        // sauf Comptabilité/Paie, réservé à un rôle dédié).
                        ->orWhere(function ($qTransverse) use ($serviceMetierId) {
                            $qTransverse->whereNull('service_metier_id')
                                ->where(function ($qExclu) use ($serviceMetierId) {
                                    $qExclu->whereNull('exclut_service_metier_id')
                                        ->orWhere('exclut_service_metier_id', '!=', $serviceMetierId);
                                });
                        });
                })->whereHas('permissions', fn ($q) => $q->where('code_perm', 'valider_documents'));
            });
        } else {
            $requete->whereHas('roles.permissions', fn ($q) => $q->where('code_perm', 'valider_documents'));
        }

        return $requete->get();
    }
}
