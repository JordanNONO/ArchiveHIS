<?php

namespace App\Http\Controllers;

use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\SuiviDelai;
use App\Models\Utilisateurs;
use Illuminate\Http\Request;

class SuiviDelaiController extends Controller
{
    /**
     * Étapes du workflow de délais défini pour une catégorie (type de dossier),
     * dans l'ordre — permet au frontend d'afficher la procédure avant de la
     * démarrer sur un document.
     */
    public function etapesPourCategorie(CategorieDocument $categorie)
    {
        return response()->json(
            $categorie->etapesWorkflow()->with('serviceResponsable')->get(),
            200
        );
    }

    /**
     * Liste des suivis actifs (non clôturés), restreinte comme pour les documents :
     * un administrateur voit tout, les autres voient les suivis dont l'étape en
     * cours relève de leur(s) service(s) — une même procédure pouvant passer de
     * service en service (ex: RH -> Comptabilité), chacun ne voit que les étapes
     * qui le concernent, pas tout le dossier.
     */
    public function index(Request $request)
    {
        $user = auth('api')->user();

        $query = SuiviDelai::whereNull('termine_le')
            ->with(['documentDeclencheur.categorieDocument', 'personnelConcerne', 'etapeWorkflow.serviceResponsable']);

        if ($request->filled('niveau_alerte')) {
            $query->where('niveau_alerte', $request->query('niveau_alerte'));
        }

        if (!$user->estAdministrateur()) {
            $serviceIds = $user->serviceMetierIds();
            $query->whereHas('etapeWorkflow', function ($q) use ($serviceIds) {
                $q->whereIn('service_responsable_id', $serviceIds);
            });
        }

        return response()->json($query->orderBy('echeance_le')->get(), 200);
    }

    /**
     * Compteurs pour le tableau de bord, restreints selon la même visibilité que
     * index().
     */
    public function compteurs()
    {
        $user = auth('api')->user();

        $query = SuiviDelai::whereNull('termine_le');

        if (!$user->estAdministrateur()) {
            $serviceIds = $user->serviceMetierIds();
            $query->whereHas('etapeWorkflow', function ($q) use ($serviceIds) {
                $q->whereIn('service_responsable_id', $serviceIds);
            });
        }

        return response()->json([
            'vert' => (clone $query)->where('niveau_alerte', 'VERT')->count(),
            'orange' => (clone $query)->where('niveau_alerte', 'ORANGE')->count(),
            'rouge' => (clone $query)->where('niveau_alerte', 'ROUGE')->count(),
        ], 200);
    }

    /**
     * Un administrateur peut tout ; sinon il faut être le propriétaire du document
     * ou appartenir au service de sa catégorie — même règle que la visibilité des
     * documents (voir DocumentController::documentEstVisiblePar()), pour ne pas
     * ouvrir un suivi de délai sur un dossier qu'on ne devrait pas voir.
     */
    private function peutAgirSurDocument(DocumentArchive $document, Utilisateurs $user): bool
    {
        if ($user->estAdministrateur()) {
            return true;
        }

        if ($document->utilisateur_id === $user->id) {
            return true;
        }

        $serviceIds = $user->serviceMetierIds();

        return $serviceIds->isNotEmpty() && $serviceIds->contains($document->categorieDocument?->service_metier_id);
    }

    /**
     * Même principe, pour agir sur une étape déjà démarrée : il faut être admin ou
     * appartenir au service responsable de CETTE étape précise — un service ne
     * doit pas pouvoir avancer/clôturer l'étape d'un autre service, même sur un
     * dossier qu'il connaît par ailleurs (ex: RH ne clôture pas l'étape Comptabilité).
     */
    private function peutAgirSurEtape(SuiviDelai $suivi, Utilisateurs $user): bool
    {
        if ($user->estAdministrateur()) {
            return true;
        }

        $serviceIds = $user->serviceMetierIds();

        return $serviceIds->isNotEmpty() && $serviceIds->contains($suivi->etapeWorkflow->service_responsable_id);
    }

    /**
     * Démarre le suivi de délai d'un document sur la première étape définie pour
     * sa catégorie (ex: la lettre de démission ouvre "Courrier initial").
     */
    public function demarrer(DocumentArchive $document)
    {
        if (!$this->peutAgirSurDocument($document, auth('api')->user())) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        if ($document->suivisDelais()->whereNull('termine_le')->exists()) {
            return response()->json(['error' => 'Ce document a déjà un suivi de délai actif'], 422);
        }

        $premiereEtape = $document->categorieDocument
            ?->etapesWorkflow()
            ->orderBy('ordre')
            ->first();

        if (!$premiereEtape) {
            return response()->json(['error' => "Aucune procédure de délai n'est définie pour ce type de dossier"], 422);
        }

        $suivi = $this->creerSuivi($document, $premiereEtape, auth('api')->id());

        return response()->json($suivi->load('etapeWorkflow.serviceResponsable'), 201);
    }

    /**
     * Fait passer un suivi à l'étape suivante de la procédure (clôt l'étape en
     * cours, ouvre la suivante avec une échéance repartie de zéro). S'il n'y a pas
     * d'étape suivante, la procédure est terminée.
     */
    public function avancer(SuiviDelai $suivi)
    {
        if (!$this->peutAgirSurEtape($suivi, auth('api')->user())) {
            return response()->json(['error' => "Cette étape ne relève pas de votre service."], 403);
        }

        if (!$suivi->estActif()) {
            return response()->json(['error' => 'Ce suivi est déjà clôturé'], 422);
        }

        $suivi->termine_le = now();
        $suivi->save();

        $etapeSuivante = $suivi->etapeWorkflow->etapeSuivante();

        if (!$etapeSuivante) {
            return response()->json(['message' => 'Procédure terminée', 'suivi' => $suivi], 200);
        }

        $nouveauSuivi = $this->creerSuivi($suivi->documentDeclencheur, $etapeSuivante, auth('api')->id(), $suivi->personnel_concerne_id);

        return response()->json($nouveauSuivi->load('etapeWorkflow.serviceResponsable'), 201);
    }

    /**
     * Clôture manuelle (cas réglé en dehors du circuit normal, procédure annulée...).
     */
    public function cloturer(SuiviDelai $suivi)
    {
        if (!$this->peutAgirSurEtape($suivi, auth('api')->user())) {
            return response()->json(['error' => "Cette étape ne relève pas de votre service."], 403);
        }

        $suivi->update(['termine_le' => now()]);

        return response()->json($suivi, 200);
    }

    private function creerSuivi(DocumentArchive $document, $etape, ?int $utilisateurId, ?int $personnelConcerneId = null): SuiviDelai
    {
        $maintenant = now();

        return SuiviDelai::create([
            'document_declencheur_id' => $document->id,
            'personnel_concerne_id' => $personnelConcerneId ?? $document->personnel_concerne_id,
            'etape_workflow_id' => $etape->id,
            'etape_demarree_le' => $maintenant,
            'echeance_le' => $maintenant->clone()->addHours($etape->delai_heures),
            'niveau_alerte' => 'VERT',
            'utilisateur_id' => $utilisateurId,
        ]);
    }
}
