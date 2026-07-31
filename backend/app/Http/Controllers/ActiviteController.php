<?php

namespace App\Http\Controllers;

use App\Models\Consultation;
use App\Models\DocumentArchive;
use App\Models\HistoriqueStatut;
use App\Enums\StatutDocument;
use Illuminate\Http\Request;

class ActiviteController extends Controller
{
    /**
     * Fil d'activité global (tous documents confondus) : changements de statut et
     * consultations, fusionnés et triés par date. Combine les données déjà
     * journalisées ailleurs plutôt que d'ajouter un nouveau système de log générique.
     */
    public function index(Request $request)
    {
        $limit = min((int) $request->query('limit', 50), 200);

        $statuts = HistoriqueStatut::with(['documentArchive', 'utilisateur.personnels'])
            ->latest('date_changement')
            ->limit($limit)
            ->get()
            ->map(function ($h) {
                return [
                    'type' => 'statut',
                    'date' => $h->date_changement,
                    'document' => $h->documentArchive ? [
                        'id' => $h->documentArchive->id,
                        'titre' => $h->documentArchive->titre_document,
                        'extension' => pathinfo($h->documentArchive->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
                    ] : null,
                    'utilisateur' => $h->utilisateur,
                    // tryFrom() plutôt que from() : l'historique est immuable et peut
                    // contenir d'anciens statuts depuis retirés de l'énumération
                    // (ex: BROUILLON, supprimé du workflow) — on affiche alors la
                    // valeur brute plutôt que de faire planter tout le fil d'activité.
                    'description' => $h->ancien_statut
                        ? sprintf(
                            'Statut changé : %s → %s',
                            StatutDocument::tryFrom($h->ancien_statut)?->name ?? $h->ancien_statut,
                            StatutDocument::tryFrom($h->nouveau_statut)?->name ?? $h->nouveau_statut
                        )
                        : 'Document créé',
                ];
            });

        $consultations = Consultation::with('user.personnels')
            ->latest()
            ->limit($limit)
            ->get();

        $docsById = DocumentArchive::whereIn('id', $consultations->pluck('document_id')->unique())
            ->get(['id', 'titre_document', 'chemin_stockage_serveur'])
            ->keyBy('id');

        $consultationEvents = $consultations->map(function ($c) use ($docsById) {
            $doc = $docsById->get($c->document_id);
            return [
                'type' => 'consultation',
                'date' => $c->created_at,
                'document' => $doc ? [
                    'id' => $doc->id,
                    'titre' => $doc->titre_document,
                    'extension' => pathinfo($doc->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
                ] : null,
                'utilisateur' => $c->user,
                'description' => 'A consulté le document',
            ];
        });

        $fil = $statuts->concat($consultationEvents)
            ->sortByDesc('date')
            ->values()
            ->take($limit);

        return response()->json($fil, 200);
    }
}
