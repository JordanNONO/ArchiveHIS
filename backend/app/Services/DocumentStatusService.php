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
// Même namespace que ce service, donc résolu même sans cet import — explicite
// quand même : sans lui, déplacer ce fichier casserait la résolution en
// silence, et à l'exécution seulement (php -l n'y voit rien).
use App\Services\DestinatairesNotification;
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
     * Catégories où le traitement des demandes d'intervenants/bénéficiaires
     * (Congés, Document administratif) revient aux Responsables Secteur, pas
     * à l'Éditeur RH qui possède pourtant la catégorie (demande explicite,
     * 2026-11) : la RH garde sa visibilité habituelle (tout le personnel
     * interne voit tout document non confidentiel, voir
     * VisibiliteDocumentService) mais ne doit plus pouvoir faire évoluer le
     * statut de CES catégories précises — ses autres catégories (Recrutement,
     * Discipline, Entretien...) ne sont pas concernées, voir
     * validateursDuService() ci-dessous.
     */
    private const CATEGORIES_VALIDATION_RESERVEE_RESPONSABLES_SECTEUR = ['CongesAbsences', 'ContratDossier'];

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

        if (in_array($nouveauStatut, self::STATUTS_NOTIFIANT_PROPRIETAIRE, true)) {
            // Règle « statut » : l'auteur du dépôt, sauf s'il a fait le
            // changement lui-même.
            $destinataires = app(DestinatairesNotification::class);
            $destinataires->envoyer(
                'statut',
                $destinataires->contexteDocument($document),
                fn () => new DocumentStatusChangedNotification($document, StatutDocument::from($nouveauStatut)),
                exclusIds: [$auteurId],
            );
        }
    }

    /**
     * Prévient qu'un nouveau document a été déposé — appelé à la fois lors
     * d'une transition vers SOUMIS (resoumission après rejet) et directement à
     * la création (voir DocumentController::store()).
     *
     * Règles « a_valider » / « archive_info » de
     * config/notifications_destinataires.php : ceux qui peuvent le valider
     * (service propriétaire, rôles transverses) + les admins. Avant, tout le
     * personnel interne recevait chaque dépôt.
     *
     * `destinatairesIds`, s'il est fourni, remplace cette règle par une liste
     * précise — l'archiviste choisit qui avertir (DocumentController::store()).
     */
    public function notifierValidateurs(DocumentArchive $document, ?int $excluUtilisateurId = null, ?array $destinatairesIds = null, bool $dejaTraite = false): void
    {
        // "Déjà traité" : rien à valider, une notification "à valider" serait
        // trompeuse — on prévient juste que le document existe.
        $fabrique = fn () => $dejaTraite
            ? new DocumentArchiveInfoNotification($document)
            : new DocumentNeedsValidationNotification($document);

        // is_null(), pas une simple vérité : un tableau VIDE ([]) veut dire
        // "personne", au sens strict, distinct de "non précisé" (null) qui
        // retombe sur la règle — un simple `$destinatairesIds ?` traiterait []
        // comme faux et notifierait selon la règle par erreur.
        if (!is_null($destinatairesIds)) {
            foreach (Utilisateurs::whereIn('id', $destinatairesIds)->get() as $destinataire) {
                $destinataire->notify($fabrique());
            }
            return;
        }

        $destinataires = app(DestinatairesNotification::class);
        $destinataires->envoyer(
            $dejaTraite ? 'archive_info' : 'a_valider',
            $destinataires->contexteDocument($document),
            $fabrique,
            exclusIds: [$excluUtilisateurId ?? auth('api')->id()],
        );
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
        // Congés/Document administratif : réservés aux Responsables Secteur
        // (voir la constante ci-dessus) — le service propriétaire (RH) garde
        // sa visibilité habituelle mais pas le droit de les traiter, donc on
        // exclut ici la branche "service propriétaire" ci-dessous pour CES
        // catégories précises seulement.
        $categorieReservee = in_array($document->categorieDocument?->code, self::CATEGORIES_VALIDATION_RESERVEE_RESPONSABLES_SECTEUR, true);

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
            $requete->whereHas('roles', function ($query) use ($serviceMetierId, $categorieReservee) {
                $query->where(function ($q) use ($serviceMetierId, $categorieReservee) {
                    if (!$categorieReservee) {
                        $q->where('service_metier_id', $serviceMetierId);
                    }
                    // Transverse (NULL) = tous les services, SAUF celui que ce rôle
                    // exclut explicitement (ex: "Responsable Secteur" qui valide tout
                    // sauf Comptabilité/Paie, réservé à un rôle dédié).
                    $q->orWhere(function ($qTransverse) use ($serviceMetierId) {
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
