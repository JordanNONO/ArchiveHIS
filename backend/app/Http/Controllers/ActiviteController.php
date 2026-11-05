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
     *
     * `q` (barre de recherche de la page Activité) : chaque mot doit se
     * trouver dans le titre/la référence du document OU le nom de la personne
     * qui a agi. Avec une recherche, on parcourt TOUT l'historique (jusqu'à
     * 500 résultats), pas seulement les 200 dernières entrées affichées sans
     * recherche — sinon une action un peu ancienne restait introuvable.
     */
    public function index(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        $mots = $q === '' ? [] : array_values(array_filter(preg_split('/[\s,;]+/u', $q), fn ($m) => $m !== ''));
        $limit = $mots ? 500 : min((int) $request->query('limit', 50), 200);

        // Les renommages vivent dans la même table mais n'ont pas leur place
        // ici : le fil afficherait « Validé → Validé » (voir renommer()).
        $statuts = HistoriqueStatut::where('type_evenement', 'statut')
            ->with(['documentArchive', 'utilisateur.personnels'])
            ->when($mots, fn ($query) => $this->filtrerParMots($query, $mots, 'documentArchive', 'utilisateur'))
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
                            StatutDocument::tryFrom($h->ancien_statut)?->libelle() ?? $h->ancien_statut,
                            StatutDocument::tryFrom($h->nouveau_statut)?->libelle() ?? $h->nouveau_statut
                        )
                        : 'Document créé',
                ];
            });

        $consultations = Consultation::with('user.personnels')
            ->when($mots, fn ($query) => $this->filtrerParMots($query, $mots, 'document', 'user'))
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

        // Tri sur le timestamp, pas sur 'date' brut : date_changement arrive en
        // chaîne et created_at en objet Carbon, et les comparer tels quels
        // mélangeait l'ordre en bas de liste (09:35, 09:32, 11:30, 09:29...).
        $fil = $statuts->concat($consultationEvents)
            ->sortByDesc(fn ($e) => $e['date'] ? \Carbon\Carbon::parse($e['date'])->getTimestamp() : 0)
            ->values()
            ->take($limit);

        return response()->json($fil, 200);
    }

    /**
     * Chaque mot doit apparaître dans le document concerné (titre, référence)
     * ou dans le nom de la personne qui a agi (prénom/nom du personnel, ou
     * nom du compte). La collation MySQL ignore déjà casse et accents.
     */
    private function filtrerParMots($query, array $mots, string $relationDocument, string $relationUtilisateur): void
    {
        foreach ($mots as $mot) {
            $like = '%' . addcslashes($mot, '%_\\') . '%';
            $query->where(function ($q) use ($like, $relationDocument, $relationUtilisateur) {
                $q->whereHas($relationDocument, fn ($d) => $d->where('titre_document', 'like', $like)->orWhere('code_reference', 'like', $like))
                    ->orWhereHas($relationUtilisateur, fn ($u) => $u->where('nom', 'like', $like)
                        ->orWhereHas('personnels', fn ($p) => $p->where('nom', 'like', $like)->orWhere('prenom', 'like', $like)));
            });
        }
    }
}
