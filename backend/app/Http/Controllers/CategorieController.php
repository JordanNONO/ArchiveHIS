<?php

namespace App\Http\Controllers;

use App\Enums\StatutDocument;
use App\Jobs\GenererZipDossier;
use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\FolderExport;
use App\Models\ServiceMetier;
use App\Models\Share;
use App\Models\TypeDocument;
use App\Models\Utilisateurs;
use App\Notifications\FolderSharedNotification;
use App\Services\VisibiliteDocumentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategorieController extends Controller
{

    /**
     * Display a listing of the resource.
     *
     * Chaque catégorie renvoie, en plus du total, une répartition de ses documents
     * par groupe de statut (attention/en_cours/traite) pour permettre au frontend
     * d'afficher un indicateur "feu tricolore" par dossier sans requête supplémentaire.
     *
     * Les dossiers eux-mêmes restent toujours listés (structure navigable par
     * tout le monde), mais les compteurs sont scopés à ce que l'utilisateur peut
     * réellement voir — un dossier hors de son service affiche 0, pas le vrai
     * total (voir VisibiliteDocumentService).
     */
    public function index(VisibiliteDocumentService $visibilite)
    {
        $user = auth('api')->user();
        $scope = function ($query) use ($visibilite, $user) {
            $visibilite->restreindre($query, $user);
        };
        $scopeAttention = function ($query) use ($visibilite, $user) {
            $query->whereIn('status_doc', StatutDocument::parGroupe('attention'));
            $visibilite->restreindre($query, $user);
        };
        $scopeEnCours = function ($query) use ($visibilite, $user) {
            $query->whereIn('status_doc', StatutDocument::parGroupe('en_cours'));
            $visibilite->restreindre($query, $user);
        };
        $scopeTraites = function ($query) use ($visibilite, $user) {
            $query->whereIn('status_doc', StatutDocument::parGroupe('traite'));
            $visibilite->restreindre($query, $user);
        };

        $categories = CategorieDocument::withCount([
            'documentArchives' => $scope,
            'documentArchives as documents_attention_count' => $scopeAttention,
            'documentArchives as documents_en_cours_count' => $scopeEnCours,
            'documentArchives as documents_traites_count' => $scopeTraites,
        ])
            ->withExists(['favorites as is_favorite' => function ($query) use ($user) {
                $query->where('utilisateur_id', $user->id);
            }])
            ->orderBy('libelle_cat')->get();

        return response()->json($categories, 200);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'label' => 'required|string|max:255|unique:categorie_documents,libelle_cat',
            'label_en' => 'nullable|string|max:255',
        ]);
        try {
            DB::beginTransaction();
            $categorie = CategorieDocument::create([
                'libelle_cat' => $validatedData['label'],
                'libelle_cat_en' => $validatedData['label_en'] ?? null,
            ]);
            DB::commit();
            return response()->json($categorie, 201);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "L'enregistrement a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    /**
     * Display the specified resource.
     *
     * Le dossier s'ouvre toujours (structure navigable par tout le monde),
     * mais son contenu réel est scopé à ce que l'utilisateur peut voir — un
     * responsable secteur qui ouvre un dossier RH voit le dossier vide, sauf
     * ce qui lui a été explicitement partagé (voir VisibiliteDocumentService).
     */
    public function show(int $id_cat, VisibiliteDocumentService $visibilite)
    {
        $user = auth('api')->user();
        $categorie = CategorieDocument::findOrFail($id_cat);
        $categorie->is_favorite = $categorie->favorites()->where('utilisateur_id', $user->id)->exists();
        $requeteDocs = DocumentArchive::where("categorie_id", '=', $id_cat)->with('typeDocument', 'personnelConcerne');
        $visibilite->restreindre($requeteDocs, $user);
        $docs = $requeteDocs->orderBy('titre_document')->get();

        // Même répartition par groupe de statut (attention/en_cours/traite) que
        // index() — pour que chaque sous-dossier affiche le même indicateur
        // "feu tricolore" que les catégories du tableau de bord (voir
        // getFolderBadgeTone()/TypeTile dans le frontend).
        $scopeAttention = function ($q) use ($visibilite, $user) {
            $q->whereIn('status_doc', StatutDocument::parGroupe('attention'));
            $visibilite->restreindre($q, $user);
        };
        $scopeEnCours = function ($q) use ($visibilite, $user) {
            $q->whereIn('status_doc', StatutDocument::parGroupe('en_cours'));
            $visibilite->restreindre($q, $user);
        };
        $scopeTraites = function ($q) use ($visibilite, $user) {
            $q->whereIn('status_doc', StatutDocument::parGroupe('traite'));
            $visibilite->restreindre($q, $user);
        };

        $types = TypeDocument::where('categorie_id', $id_cat)
            ->withCount([
                'documentArchives' => function ($q) use ($visibilite, $user) {
                    $visibilite->restreindre($q, $user);
                },
                'documentArchives as documents_attention_count' => $scopeAttention,
                'documentArchives as documents_en_cours_count' => $scopeEnCours,
                'documentArchives as documents_traites_count' => $scopeTraites,
            ])
            ->orderBy('libelle')
            ->get();

        return response()->json(['dossier' => $categorie, 'documents' => $docs, 'types' => $types], 200);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(int $id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, int $id_cat)
    {
        $validatedData = $request->validate([
            'label' => ['required', 'string', 'max:255', Rule::unique('categorie_documents', 'libelle_cat')->ignore($id_cat)],
            'label_en' => 'nullable|string|max:255',
        ]);

        try {
            // Les documents sont stockés dans des dossiers basés sur l'identifiant
            // de la catégorie (voir DocumentController::store), jamais sur son
            // libellé affiché : renommer une catégorie est une simple mise à jour
            // de base de données, aucun fichier n'a besoin d'être déplacé.
            $categorie = CategorieDocument::findOrFail($id_cat);
            if ($categorie->estVerrouille()) {
                return response()->json(['error' => 'Ce dossier est verrouillé — déverrouillez-le avant de le renommer.'], 423);
            }
            $categorie->update([
                'libelle_cat' => $validatedData['label'],
                // Ne touche à la traduction que si elle est explicitement
                // envoyée — sinon un simple renommage du libellé français (sans
                // passer par le champ anglais) effacerait la traduction déjà
                // saisie.
                ...($request->has('label_en') ? ['libelle_cat_en' => $validatedData['label_en']] : []),
            ]);
            return response()->json($categorie, 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "La mise à jour a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    /**
     * Demande le téléchargement de tous les documents d'une catégorie : génère le
     * ZIP en tâche de fond (voir GenererZipDossier) plutôt que de bloquer la requête,
     * et prévient l'utilisateur par notification quand l'archive est prête.
     */
    public function download(int $id_cat, VisibiliteDocumentService $visibilite)
    {
        $categorie = CategorieDocument::findOrFail($id_cat);
        $requeteDocs = DocumentArchive::where('categorie_id', $id_cat);
        $visibilite->restreindre($requeteDocs, auth('api')->user());
        $nombreDocuments = $requeteDocs->count();

        if ($nombreDocuments === 0) {
            return response()->json(['error' => 'Ce dossier ne contient aucun document.'], 422);
        }

        $export = FolderExport::create([
            'utilisateur_id' => auth('api')->id(),
            'categorie_id' => $categorie->id,
            'nom_dossier' => $categorie->libelle_cat,
            'statut' => 'en_attente',
        ]);

        GenererZipDossier::dispatch($export);

        return response()->json([
            'message' => "Préparation de l'archive en cours, vous serez notifié quand elle sera prête.",
            'export' => $export,
        ], 202);
    }

    /**
     * Partage un dossier entier avec un collègue ou tout un service métier —
     * contrairement au partage document par document (DocumentController::share,
     * qui peut aller jusqu'à un email externe avec pièce jointe), celui-ci reste
     * volontairement interne : il donne accès à TOUT le contenu du dossier via
     * VisibiliteDocumentService (voir la vérification `categorieDocument.shares`
     * ajoutée là-bas), ce qui n'aurait pas de sens à envoyer par email à un tiers.
     */
    public function share(Request $request, CategorieDocument $folder)
    {
        $validated = $request->validate([
            'destinataire_utilisateur_id' => 'nullable|integer|exists:utilisateurs,id',
            'service_metier_id' => 'nullable|integer|exists:services_metier,id',
            'message' => 'nullable|string|max:1000',
        ]);

        $ciblesRenseignees = array_filter([
            $validated['destinataire_utilisateur_id'] ?? null,
            $validated['service_metier_id'] ?? null,
        ]);

        if (count($ciblesRenseignees) !== 1) {
            return response()->json(['error' => 'Veuillez choisir un seul destinataire : un collègue, ou un service métier.'], 422);
        }

        $expediteur = auth('api')->user();
        $message = $validated['message'] ?? null;

        if (!empty($validated['service_metier_id'])) {
            $service = ServiceMetier::findOrFail($validated['service_metier_id']);
            $membres = Utilisateurs::whereHas('roles', function ($query) use ($service) {
                $query->where('service_metier_id', $service->id);
            })->where('id', '!=', $expediteur->id)->get();

            if ($membres->isEmpty()) {
                return response()->json(['error' => "Aucun membre trouvé dans le service {$service->nom_service}."], 422);
            }

            foreach ($membres as $membre) {
                $folder->shares()->create([
                    'utilisateur_id' => $expediteur->id,
                    'destinataire_utilisateur_id' => $membre->id,
                    'type_partage' => 'service',
                    'message' => $message,
                    'service_metier_id' => $service->id,
                    'permissions' => 'read',
                ]);
                $membre->notify(new FolderSharedNotification($folder, $expediteur->nom, $message, $service->nom_service));
            }

            return response()->json(['message' => "Dossier transmis au service {$service->nom_service}."], 200);
        }

        $destinataire = Utilisateurs::findOrFail($validated['destinataire_utilisateur_id']);
        $folder->shares()->create([
            'utilisateur_id' => $expediteur->id,
            'destinataire_utilisateur_id' => $destinataire->id,
            'type_partage' => 'interne',
            'message' => $message,
            'permissions' => 'read',
        ]);
        $destinataire->notify(new FolderSharedNotification($folder, $expediteur->nom, $message));

        return response()->json(['message' => 'Dossier partagé avec succès.'], 200);
    }

    /**
     * Gèle un dossier (ex: le temps d'un audit) : bloque tout nouveau dépôt,
     * la création de sous-dossiers, et le renommage/suppression du dossier ou
     * de ses sous-dossiers — voir estVerrouille() et les vérifications dans
     * DocumentController::store / TypeDocumentController::store/update/destroy.
     * Réservé à qui peut gérer les catégories (même garde que store/update/destroy).
     */
    public function verrouiller(Request $request, CategorieDocument $folder)
    {
        $folder->update(['verrouille_par_utilisateur_id' => auth('api')->id(), 'verrouille_le' => now()]);

        return response()->json($folder->fresh('verrouillePar'), 200);
    }

    public function deverrouiller(Request $request, CategorieDocument $folder)
    {
        $folder->update(['verrouille_par_utilisateur_id' => null, 'verrouille_le' => null]);

        return response()->json($folder->fresh(), 200);
    }

    public function favorite(Request $request, CategorieDocument $folder)
    {
        $folder->favorites()->firstOrCreate(['utilisateur_id' => auth('api')->id()]);

        return response()->json(['message' => 'Dossier épinglé avec succès.']);
    }

    public function unfavorite(Request $request, CategorieDocument $folder)
    {
        $folder->favorites()->where('utilisateur_id', auth('api')->id())->delete();

        return response()->json(['message' => 'Dossier retiré des favoris.']);
    }
    /**
     * Remove the specified resource from storage.
     */
    public function destroy(int $id_cat)
    {
        try {
            DB::beginTransaction();
            $categorie = CategorieDocument::findOrFail($id_cat);
            if ($categorie->estVerrouille()) {
                DB::rollback();
                return response()->json(['error' => 'Ce dossier est verrouillé — déverrouillez-le avant de le supprimer.'], 423);
            }
            $categorie->delete();
            DB::commit();
            return response()->json(['message' => 'Catégorie supprimée avec succès'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "La suppression a échoué. Réessayez dans quelques instants."], 500);
        }
    }
}
