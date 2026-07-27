<?php

namespace App\Http\Controllers;

use App\Enums\StatutDocument;
use App\Mail\DocumentSharedMail;
use App\Models\Consultation;
use App\Models\DocumentArchive;
use App\Models\DocumentVersion;
use App\Models\HistoriqueStatut;
use App\Models\Share;
use App\Models\ServiceMetier;
use App\Models\Utilisateurs;
use App\Notifications\DocumentSharedNotification;
use App\Services\DocumentStatusService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class DocumentController extends Controller
{
    public function index()
    {
        $docs = DocumentArchive::with('utilisateur', 'categorieDocument', 'typeDocument', 'personnelConcerne')->get();
        return response()->json($docs, 200);
    }

    /**
     * Documents récemment partagés par un collègue avec l'utilisateur connecté
     * (partages internes uniquement — un particulier externe ne peut que recevoir,
     * jamais déposer de document dans l'application).
     */
    public function partagesRecus(Request $request)
    {
        $partages = Share::with(['shareable.categorieDocument', 'user.personnels', 'serviceMetier'])
            ->where('destinataire_utilisateur_id', auth('api')->id())
            ->whereIn('type_partage', ['interne', 'service'])
            ->latest()
            ->limit((int) $request->query('limit', 6))
            ->get();

        return response()->json($partages, 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validatedData = $request->validate([
            'category_id' => 'required|integer|exists:categorie_documents,id',
            'type_document_id' => [
                'required',
                'integer',
                Rule::exists('type_documents', 'id')->where('categorie_id', $request->input('category_id')),
            ],
            'titre' => 'required|string|max:255',
            'auteur' => 'required|string|max:255',
            'resume' => 'required|string',
            'reference' => 'required|string|max:255',
            'file_create_date' => 'required|integer',
            'duree_conservation_annees' => 'nullable|integer|min:1|max:99',
            'niveau_confidentialite' => 'nullable|string|in:PUBLIC,INTERNE,CONFIDENTIEL,STRICTEMENT_CONFIDENTIEL',
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'nom_personne_concernee' => 'nullable|string|max:255',
            'file' => 'required|file|mimes:pdf,doc,docx,odt,ppt,pptx,odp,csv,xls,xlsx,ods,txt,rtf,zip,jpg,jpeg,png|max:32048',
        ]);

        $data = [
            'utilisateur_id' => auth('api')->id(),
            'personnel_concerne_id' => $validatedData['personnel_concerne_id'] ?? null,
            'nom_personne_concernee' => empty($validatedData['personnel_concerne_id']) ? ($validatedData['nom_personne_concernee'] ?? null) : null,
            'categorie_id' => $validatedData['category_id'],
            'type_document_id' => $validatedData['type_document_id'],
            'titre_document' => $validatedData['titre'],
            'auteur' => $validatedData['auteur'],
            'resume' => $validatedData['resume'],
            'code_reference' => $validatedData['reference'],
            'duree_conservation_annees' => $validatedData['duree_conservation_annees'] ?? 5,
            'niveau_confidentialite' => $validatedData['niveau_confidentialite'] ?? 'INTERNE',
            'status_doc' => StatutDocument::BROUILLON->value,
        ];

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $contenu = file_get_contents($file->getRealPath());
            $nomFichier = $data['titre_document'] . '.' . $file->extension();
            // Dossier basé sur les identifiants (stables), jamais sur le libellé
            // affiché (modifiable) — renommer une catégorie ou un type ne doit
            // jamais nécessiter de déplacer les fichiers déjà archivés.
            $dossier = "categorie_{$data['categorie_id']}/type_{$data['type_document_id']}";
            $chemin = $dossier . '/' . $nomFichier;

            Storage::disk(config('filesystems.document_disk'))->makeDirectory($dossier);
            Storage::disk(config('filesystems.document_disk'))->put($chemin, $contenu);

            $data['nom_fichier_original'] = $file->getClientOriginalName();
            $data['chemin_stockage_serveur'] = $chemin;
            $data['format_mime'] = $file->getMimeType();
            $data['taille'] = $file->getSize();
            $data['checksum_sha256'] = hash('sha256', $contenu);
            $data['file_create_date'] = date('Y-m-d', strtotime(date(DATE_ATOM, $validatedData['file_create_date'])));
        }

        try {
            DB::beginTransaction();
            $document = DocumentArchive::create($data);

            HistoriqueStatut::create([
                'document_archive_id' => $document->id,
                'utilisateur_id' => auth('api')->id(),
                'ancien_statut' => null,
                'nouveau_statut' => StatutDocument::BROUILLON->value,
                'date_changement' => now(),
                'motif_changement' => 'Création du document',
            ]);

            DB::commit();
            return response()->json(['message' => 'Document créé avec succès', 'document' => $document], 201);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur d'enregistrement: " . $th->getMessage()], 500);
        }
    }

    /**
     * Partage un document, soit avec un collègue (personnel de l'application),
     * soit par email avec un particulier externe. Dans les deux cas, l'envoi
     * se fait par e-mail, avec le document en pièce jointe.
     */
    public function share(Request $request, DocumentArchive $document)
    {
        $validated = $request->validate([
            'destinataire_utilisateur_id' => 'nullable|integer|exists:utilisateurs,id',
            'email' => 'nullable|email',
            'service_metier_id' => 'nullable|integer|exists:services_metier,id',
            'message' => 'nullable|string|max:1000',
        ]);

        $ciblesRenseignees = array_filter([
            $validated['destinataire_utilisateur_id'] ?? null,
            $validated['email'] ?? null,
            $validated['service_metier_id'] ?? null,
        ]);

        if (count($ciblesRenseignees) !== 1) {
            return response()->json(['error' => 'Veuillez choisir un seul destinataire : un collègue, un service métier, ou un email.'], 422);
        }

        $expediteur = auth('api')->user();
        $message = $validated['message'] ?? null;

        if (!empty($validated['service_metier_id'])) {
            return $this->partagerVersService($document, $expediteur, $validated['service_metier_id'], $message);
        }

        $isExternal = empty($validated['destinataire_utilisateur_id']);
        $destinataire = $isExternal ? null : Utilisateurs::find($validated['destinataire_utilisateur_id']);
        $emailDestination = $isExternal ? $validated['email'] : $destinataire->mail;

        try {
            Mail::to($emailDestination)->send(new DocumentSharedMail(
                $document,
                $expediteur->nom,
                $message,
                $isExternal
            ));

            if (!$isExternal) {
                $destinataire->notify(new DocumentSharedNotification($document, $expediteur->nom, $message));
            }

            $document->shares()->create([
                'utilisateur_id' => $expediteur->id,
                'destinataire_utilisateur_id' => $isExternal ? null : $destinataire->id,
                'email_destinataire' => $isExternal ? $emailDestination : null,
                'type_partage' => $isExternal ? 'email' : 'interne',
                'message' => $message,
                'permissions' => 'read',
            ]);

            return response()->json(['message' => 'Document partagé avec succès.'], 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "L'envoi du document a échoué: " . $th->getMessage()], 500);
        }
    }

    /**
     * Transmet le document à tous les membres d'un service métier (ex: le service RH
     * transmet un CV au service Qualité) : chacun reçoit l'email de partage et une
     * notification, sans passer par le workflow de validation du document.
     */
    private function partagerVersService(DocumentArchive $document, Utilisateurs $expediteur, int $serviceMetierId, ?string $message)
    {
        $service = ServiceMetier::findOrFail($serviceMetierId);

        $membres = Utilisateurs::whereHas('roles', function ($query) use ($serviceMetierId) {
            $query->where('service_metier_id', $serviceMetierId);
        })->where('id', '!=', $expediteur->id)->get();

        if ($membres->isEmpty()) {
            return response()->json(['error' => "Aucun membre trouvé dans le service {$service->nom_service}."], 422);
        }

        $envoisReussis = 0;

        foreach ($membres as $membre) {
            try {
                Mail::to($membre->mail)->send(new DocumentSharedMail($document, $expediteur->nom, $message, false, $service->nom_service));
                $membre->notify(new DocumentSharedNotification($document, $expediteur->nom, $message, $service->nom_service));

                $document->shares()->create([
                    'utilisateur_id' => $expediteur->id,
                    'destinataire_utilisateur_id' => $membre->id,
                    'type_partage' => 'service',
                    'message' => $message,
                    'service_metier_id' => $service->id,
                    'permissions' => 'read',
                ]);

                $envoisReussis++;
            } catch (\Throwable $th) {
                report($th);
            }
        }

        if ($envoisReussis === 0) {
            return response()->json(['error' => "La transmission au service {$service->nom_service} a échoué."], 500);
        }

        return response()->json([
            'message' => "Document transmis au service {$service->nom_service} ({$envoisReussis} destinataire(s)).",
        ], 200);
    }

    public function favorite(Request $request, DocumentArchive $file)
    {
        // Logic to add the file to the user's favorites
        $user = auth('api')->user();
        $user->favoriteFiles()->attach($file);

        return response()->json(['message' => 'File favorited successfully.']);
    }

    public function unfavorite(Request $request, DocumentArchive $file)
    {
        // Logic to remove the file from the user's favorites
        $user = auth('api')->user();
        $user->favoriteFiles()->detach($file);

        return response()->json(['message' => 'File unfavorited successfully.']);
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, int $doc_id)
    {
        $document = DocumentArchive::with('utilisateur', 'categorieDocument', 'typeDocument')->findOrFail($doc_id);

        $response = response(Storage::disk(config('filesystems.document_disk'))->get($document->chemin_stockage_serveur))
            ->header('Content-Type', $document->format_mime ?? 'application/octet-stream');

        if ($request->boolean('download')) {
            $extension = pathinfo($document->chemin_stockage_serveur, PATHINFO_EXTENSION);
            $nomTelecharge = $document->nom_fichier_original ?: ($document->titre_document . '.' . $extension);
            $response->header('Content-Disposition', 'attachment; filename="' . $nomTelecharge . '"');
        }

        return $response;
    }

    /**
     * Métadonnées JSON du document (titre, statut, catégorie...), sans le contenu du fichier.
     */
    public function meta(DocumentArchive $document)
    {
        return response()->json($document->load('utilisateur', 'categorieDocument', 'typeDocument', 'personnelConcerne'), 200);
    }

    /**
     * Liste des anciennes versions du fichier (avant chaque remplacement).
     */
    public function versions(DocumentArchive $document)
    {
        return response()->json($document->versions()->with('utilisateur')->get(), 200);
    }

    /**
     * Remplace le fichier d'un document déjà archivé : l'ancien fichier est conservé
     * (chemin distinct sur le disque) et référencé dans document_versions, afin de
     * pouvoir être retéléchargé après remplacement.
     */
    public function newVersion(Request $request, DocumentArchive $document)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,doc,docx,odt,ppt,pptx,odp,csv,xls,xlsx,ods,txt,rtf,zip,jpg,jpeg,png|max:32048',
        ]);

        try {
            DB::beginTransaction();

            $prochainNumero = $document->versions()->count() + 1;

            DocumentVersion::create([
                'document_archive_id' => $document->id,
                'numero_version' => $prochainNumero,
                'utilisateur_id' => auth('api')->id(),
                'nom_fichier_original' => $document->nom_fichier_original,
                'chemin_stockage_serveur' => $document->chemin_stockage_serveur,
                'format_mime' => $document->format_mime,
                'taille' => $document->taille,
                'checksum_sha256' => $document->checksum_sha256,
            ]);

            $file = $request->file('file');
            $contenu = file_get_contents($file->getRealPath());
            $dossier = "categorie_{$document->categorie_id}/type_{$document->type_document_id}";
            $nomFichier = uniqid('v' . ($prochainNumero + 1) . '_') . '.' . $file->extension();
            $chemin = $dossier . '/' . $nomFichier;

            Storage::disk(config('filesystems.document_disk'))->makeDirectory($dossier);
            Storage::disk(config('filesystems.document_disk'))->put($chemin, $contenu);

            $document->update([
                'nom_fichier_original' => $file->getClientOriginalName(),
                'chemin_stockage_serveur' => $chemin,
                'format_mime' => $file->getMimeType(),
                'taille' => $file->getSize(),
                'checksum_sha256' => hash('sha256', $contenu),
            ]);

            DB::commit();
            return response()->json($document->fresh(), 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur lors du remplacement du fichier: " . $th->getMessage()], 500);
        }
    }

    /**
     * Télécharge le contenu d'une ancienne version du fichier.
     */
    public function downloadVersion(DocumentArchive $document, int $versionId)
    {
        $version = $document->versions()->where('id', $versionId)->firstOrFail();

        return response(Storage::disk(config('filesystems.document_disk'))->get($version->chemin_stockage_serveur))
            ->header('Content-Type', $version->format_mime ?? 'application/octet-stream')
            ->header('Content-Disposition', 'attachment; filename="' . $version->nom_fichier_original . '"');
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, int $doc_id)
    {
        $validatedData = $request->validate([
            'category_id' => 'required|integer|exists:categorie_documents,id',
            'type_document_id' => [
                'nullable',
                'integer',
                Rule::exists('type_documents', 'id')->where('categorie_id', $request->input('category_id')),
            ],
            'titre' => 'required|string|max:255',
            'auteur' => 'required|string|max:255',
            'resume' => 'required|string',
            'reference' => 'required|string|max:255',
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'nom_personne_concernee' => 'nullable|string|max:255',
        ]);

        try {
            $document = DocumentArchive::findOrFail($doc_id);

            $document->update([
                'categorie_id' => $validatedData['category_id'],
                'type_document_id' => $validatedData['type_document_id'] ?? $document->type_document_id,
                'titre_document' => $validatedData['titre'],
                'auteur' => $validatedData['auteur'],
                'resume' => $validatedData['resume'],
                'code_reference' => $validatedData['reference'],
                'personnel_concerne_id' => $validatedData['personnel_concerne_id'] ?? null,
                'nom_personne_concernee' => empty($validatedData['personnel_concerne_id']) ? ($validatedData['nom_personne_concernee'] ?? null) : null,
            ]);

            return response()->json($document, 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => 'Erreur de mise à jour: ' . $th->getMessage()], 500);
        }
    }

    /**
     * Envoie le document à la corbeille (suppression douce) : le fichier reste sur le
     * disque tant que le document n'est pas définitivement purgé, pour permettre une
     * restauration.
     */
    public function destroy(int $doc_id)
    {
        try {
            DB::beginTransaction();
            $document = DocumentArchive::findOrFail($doc_id);
            $document->delete();
            DB::commit();
            return response()->json(['message' => 'Document envoyé à la corbeille'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }

    /**
     * Liste des documents dans la corbeille — uniquement ceux du propriétaire
     * connecté (chacun a sa propre corbeille, pas une corbeille globale partagée).
     */
    public function trash()
    {
        $docs = DocumentArchive::onlyTrashed()
            ->where('utilisateur_id', auth('api')->id())
            ->with('utilisateur', 'categorieDocument', 'typeDocument', 'personnelConcerne')
            ->orderByDesc('deleted_at')
            ->get();

        return response()->json($docs, 200);
    }

    /**
     * Restaure un document depuis la corbeille (uniquement le sien).
     */
    public function restore(int $doc_id)
    {
        try {
            $document = DocumentArchive::onlyTrashed()
                ->where('utilisateur_id', auth('api')->id())
                ->findOrFail($doc_id);
            $document->restore();
            return response()->json($document, 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => "Erreur de restauration: " . $th->getMessage()], 500);
        }
    }

    /**
     * Supprime définitivement un document de la corbeille (fichier + enregistrement),
     * uniquement le sien.
     */
    public function forceDestroy(int $doc_id)
    {
        try {
            DB::beginTransaction();
            $document = DocumentArchive::onlyTrashed()
                ->where('utilisateur_id', auth('api')->id())
                ->findOrFail($doc_id);

            if ($document->chemin_stockage_serveur) {
                Storage::disk(config('filesystems.document_disk'))->delete($document->chemin_stockage_serveur);
            }

            $document->forceDelete();
            DB::commit();
            return response()->json(['message' => 'Document supprimé définitivement'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            return response()->json(['error' => "Erreur de suppression: " . $th->getMessage()], 500);
        }
    }

    /**
     * Documents qui méritent une attention proche : en attente de validation depuis
     * plus de 7 jours, ou dont la durée de conservation arrive à échéance dans moins
     * de 90 jours (ou déjà dépassée). Limité à 5 de chaque pour rester un aperçu, pas
     * une liste exhaustive.
     */
    public function aTraiter()
    {
        $seuilAttente = now()->subDays(7);
        $dernierChangement = HistoriqueStatut::selectRaw('document_archive_id, MAX(date_changement) as derniere_date')
            ->groupBy('document_archive_id');

        $enAttente = DocumentArchive::query()
            ->whereIn('status_doc', [
                StatutDocument::SOUMIS->value,
                StatutDocument::TRANSMIS_AU_SERVICE->value,
                StatutDocument::EN_COURS_DE_TRAITEMENT->value,
            ])
            ->joinSub($dernierChangement, 'derniers', function ($join) {
                $join->on('document_archives.id', '=', 'derniers.document_archive_id');
            })
            ->where('derniers.derniere_date', '<=', $seuilAttente)
            ->orderBy('derniers.derniere_date')
            ->limit(5)
            ->get(['document_archives.*', 'derniers.derniere_date']);

        $seuilPurge = now()->addDays(90);
        $aPurger = DocumentArchive::query()
            ->whereIn('status_doc', [StatutDocument::ARCHIVE->value, StatutDocument::EXPIRE_A_PURGER->value])
            ->whereNotNull('date_archivage')
            ->whereNotNull('duree_conservation_annees')
            ->whereRaw('DATE_ADD(date_archivage, INTERVAL duree_conservation_annees YEAR) <= ?', [$seuilPurge])
            ->orderByRaw('DATE_ADD(date_archivage, INTERVAL duree_conservation_annees YEAR) ASC')
            ->limit(5)
            ->get();

        return response()->json([
            'en_attente' => $enAttente->map(fn ($d) => [
                'id' => $d->id,
                'titre' => $d->titre_document,
                'extension' => pathinfo($d->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
                'statut' => $d->status_doc,
                'depuis' => $d->derniere_date,
            ]),
            'a_purger' => $aPurger->map(fn ($d) => [
                'id' => $d->id,
                'titre' => $d->titre_document,
                'extension' => pathinfo($d->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
                'echeance' => \Carbon\Carbon::parse($d->date_archivage)->addYears((int) $d->duree_conservation_annees)->toDateString(),
            ]),
        ], 200);
    }

    /**
     * Fait transitionner le document vers un nouveau statut du workflow.
     */
    public function transition(Request $request, DocumentArchive $document, DocumentStatusService $service)
    {
        $validated = $request->validate([
            'nouveau_statut' => 'required|string',
            'motif' => 'nullable|string',
        ]);

        try {
            $document = $service->transitionTo($document, $validated['nouveau_statut'], $validated['motif'] ?? null);
            return response()->json($document, 200);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Historique des changements de statut du document.
     */
    public function historique(DocumentArchive $document)
    {
        return response()->json($document->historiqueStatuts, 200);
    }

    /**
     * Personnes ayant consulté le document (une entrée par utilisateur, voir la
     * contrainte unique sur consultations.utilisateur_id+document_id : ceci reflète
     * la première consultation de chacun, pas un journal de chaque ouverture).
     */
    public function consultations(DocumentArchive $document)
    {
        $consultations = Consultation::with('user.personnels')
            ->where('document_id', $document->id)
            ->latest()
            ->get();

        return response()->json($consultations, 200);
    }

    /**
     * Vérifie l'intégrité du fichier archivé (checksum SHA-256).
     */
    public function verifierIntegrite(DocumentArchive $document)
    {
        return response()->json(['integre' => $document->verifierIntegrite()], 200);
    }

    public function countDoc()
    {
        try {
            // Récupérer tous les documents
            $documents = DocumentArchive::all();

            // Initialiser un tableau pour les comptages par extension
            $counts = [
                'pdf' => 0,
                'doc' => 0,
                'docx' => 0,
                'xls' => 0,
                'xlsx' => 0,
                'csv' => 0,
                'ppt' => 0,
                'pptx' => 0,
                'others' => 0
            ];

            // Parcourir les documents et compter les extensions
            foreach ($documents as $document) {
                $extension = strtolower(pathinfo($document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION));
                if (array_key_exists($extension, $counts)) {
                    $counts[$extension]++;
                } else {
                    $counts['others']++;
                }
            }

            return response()->json([
                'documents' => $documents,
                'counts' => $counts
            ], 200);
        } catch (\Throwable $th) {
            return response()->json(['error' => "Erreur de récupération: " . $th->getMessage()], 500);
        }
    }
}
