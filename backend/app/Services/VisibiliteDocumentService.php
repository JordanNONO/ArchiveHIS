<?php

namespace App\Services;

use App\Models\DocumentArchive;
use App\Models\Utilisateurs;
use Illuminate\Database\Eloquent\Builder;

/**
 * Règle de visibilité unique des documents, partagée par TOUS les points
 * d'accès (liste, dossier ouvert, fiche, export ZIP...) — auparavant
 * dupliquée uniquement dans DocumentController et absente ailleurs
 * (CategorieController::show()/download(), TypeDocumentController::download(),
 * GenererZipDossier laissaient passer n'importe quel document sans contrôle).
 *
 * Principe : la STRUCTURE (catégories, sous-dossiers) reste toujours visible
 * pour naviguer — "tout le monde doit pouvoir toucher à tout" — mais le
 * CONTENU d'un dossier qui n'appartient pas à son service reste vide, sauf ce
 * qui a été explicitement partagé (à soi ou à son service) : un responsable
 * secteur voit ses propres dossiers pleins, les autres vides, jusqu'à ce
 * qu'un document précis lui soit partagé — il ne voit alors que celui-là.
 */
class VisibiliteDocumentService
{
    /**
     * Restreint une requête aux documents visibles par l'utilisateur : un
     * administrateur voit tout ; les autres voient les documents publics/internes,
     * les leurs, ceux de leur(s) service(s) (via la catégorie propriétaire), et ceux
     * qui leur ont été explicitement partagés (à eux ou à leur service).
     */
    public function restreindre(Builder $query, Utilisateurs $user): void
    {
        if ($user->estAdministrateur() || $user->estViewer()) {
            return;
        }

        // Dossier verrouillé ("gel administratif") : invisible à tout le
        // monde sauf à qui l'a verrouillé — voir CategorieDocument::estAccessibleMalgreVerrou().
        $query->where(function ($q) use ($user) {
            $q->whereDoesntHave('categorieDocument', fn ($qc) => $qc->whereNotNull('verrouille_par_utilisateur_id'))
                ->orWhereHas('categorieDocument', fn ($qc) => $qc->where('verrouille_par_utilisateur_id', $user->id));
        });

        $serviceIds = $user->serviceMetierIds();
        // Tout le personnel interne voit tout ce qui n'est pas confidentiel, quel
        // que soit son service — être informé ne veut pas dire pouvoir traiter
        // (voir DocumentStatusService::peutValider(), seul filtre qui reste scopé
        // au service pour les actions de statut). Un compte "dépôt" (intervenant,
        // bénéficiaire) reste à part : sans le droit consulter_archives explicite,
        // il ne voit que ce qu'il a lui-même déposé ou ce qui lui a été
        // explicitement partagé, jamais les documents publics/internes de
        // tout le monde.
        $consulteArchives = !$user->estCompteDepot() || $user->hasPermission('consulter_archives');

        $query->where(function ($q) use ($user, $serviceIds, $consulteArchives) {
            if ($consulteArchives) {
                $q->whereIn('niveau_confidentialite', ['PUBLIC', 'INTERNE'])
                    ->orWhereNull('niveau_confidentialite');
            }

            $q->orWhere('utilisateur_id', $user->id)
                ->orWhereHas('categorieDocument', function ($qc) use ($serviceIds) {
                    $qc->whereIn('service_metier_id', $serviceIds);
                })
                ->orWhereHas('shares', function ($qs) use ($user, $serviceIds) {
                    $qs->where('destinataire_utilisateur_id', $user->id)
                        ->orWhereIn('service_metier_id', $serviceIds);
                })
                ->orWhereHas('categorieDocument.shares', function ($qs) use ($user, $serviceIds) {
                    $qs->where('destinataire_utilisateur_id', $user->id)
                        ->orWhereIn('service_metier_id', $serviceIds);
                });
        });
    }

    /**
     * Même règle que restreindre(), appliquée à un document déjà chargé — pour
     * les endpoints par ID (meta, historique, consultations, versions...) que
     * le filtrage de la liste n'empêche pas d'atteindre en devinant/collant une URL.
     */
    public function estVisiblePar(DocumentArchive $document, Utilisateurs $user): bool
    {
        if ($user->estAdministrateur() || $user->estViewer()) {
            return true;
        }

        if ($document->categorieDocument && !$document->categorieDocument->estAccessibleMalgreVerrou($user)) {
            return false;
        }

        $voitTout = !$user->estCompteDepot() || $user->hasPermission('consulter_archives');
        if ($voitTout && in_array($document->niveau_confidentialite, [null, 'PUBLIC', 'INTERNE'], true)) {
            return true;
        }

        if ($document->utilisateur_id === $user->id) {
            return true;
        }

        $serviceIds = $user->serviceMetierIds();

        if ($serviceIds->isNotEmpty() && $serviceIds->contains($document->categorieDocument?->service_metier_id)) {
            return true;
        }

        $partageDirect = $document->shares()
            ->where(function ($q) use ($user, $serviceIds) {
                $q->where('destinataire_utilisateur_id', $user->id)
                    ->orWhereIn('service_metier_id', $serviceIds);
            })
            ->exists();

        if ($partageDirect) {
            return true;
        }

        return (bool) $document->categorieDocument?->shares()
            ->where(function ($q) use ($user, $serviceIds) {
                $q->where('destinataire_utilisateur_id', $user->id)
                    ->orWhereIn('service_metier_id', $serviceIds);
            })
            ->exists();
    }
}
