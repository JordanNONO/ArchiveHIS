<?php

namespace App\Http\Controllers;

use App\Enums\StatutDocument;
use App\Events\DocumentStatutMisAJour;
use App\Mail\CongeDecisionMail;
use App\Mail\DocumentSharedExternalMail;
use App\Mail\DocumentSharedMail;
use App\Models\CategorieDocument;
use App\Models\Consultation;
use App\Models\DocumentArchive;
use App\Models\DocumentVersion;
use App\Models\HistoriqueStatut;
use App\Models\Personnels;
use App\Models\Share;
use App\Models\ServiceMetier;
use App\Models\TypeDocument;
use App\Models\Utilisateurs;
use App\Notifications\DocumentSharedNotification;
use App\Services\DocumentAnalysisIAService;
use App\Services\DocumentStatusService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class DocumentController extends Controller
{
    public function index()
    {
        $user = auth('api')->user();
        $query = DocumentArchive::with('utilisateur.roles', 'categorieDocument', 'typeDocument', 'personnelConcerne', 'suiviDelaiActif.etapeWorkflow')
            ->withExists(['favorites as is_favorite' => function ($q) use ($user) {
                $q->where('utilisateur_id', $user->id);
            }]);
        $this->restreindreParVisibilite($query, $user);

        return response()->json($query->orderBy('titre_document')->get(), 200);
    }

    /**
     * Recherche plein texte côté serveur — jusqu'ici toute la recherche se
     * faisait côté navigateur sur la liste déjà chargée (voir recherche.js),
     * sans passer par un index (texte_extrait n'était jamais interrogé côté
     * SQL). Mêmes règles de visibilité que index() : ne jamais renvoyer un
     * document que l'utilisateur ne devrait pas voir juste parce qu'il
     * matche la requête.
     */
    public function recherche(Request $request)
    {
        $q = trim((string) $request->query('q', ''));
        if ($q === '') {
            return response()->json([], 200);
        }

        $user = auth('api')->user();
        $query = DocumentArchive::with('utilisateur.roles', 'categorieDocument', 'typeDocument', 'personnelConcerne', 'suiviDelaiActif.etapeWorkflow')
            ->withExists(['favorites as is_favorite' => function ($fav) use ($user) {
                $fav->where('utilisateur_id', $user->id);
            }]);

        // InnoDB ignore par défaut les mots de moins de 3 caractères dans un
        // index FULLTEXT (innodb_ft_min_token_size, réglage serveur global) —
        // "RH" ne remonterait donc jamais rien en MATCH AGAINST. On bascule
        // sur un LIKE pour les requêtes courtes plutôt que de dépendre d'une
        // configuration MySQL à changer sur le serveur de production.
        if (mb_strlen($q) < 4) {
            $query->where('texte_recherche', 'like', '%' . $q . '%');
        } else {
            $query->whereFullText('texte_recherche', $q);
        }

        $this->restreindreParVisibilite($query, $user);

        return response()->json($query->get(), 200);
    }

    /**
     * Délègue à VisibiliteDocumentService (partagée avec CategorieController,
     * TypeDocumentController et GenererZipDossier) — signature inchangée pour
     * ne toucher aucun des nombreux appels existants dans ce contrôleur.
     */
    private function restreindreParVisibilite($query, Utilisateurs $user): void
    {
        (new \App\Services\VisibiliteDocumentService())->restreindre($query, $user);
    }

    /**
     * Idem, voir VisibiliteDocumentService::estVisiblePar().
     */
    private function documentEstVisiblePar(DocumentArchive $document, Utilisateurs $user): bool
    {
        return (new \App\Services\VisibiliteDocumentService())->estVisiblePar($document, $user);
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
    public function store(Request $request, DocumentStatusService $documentStatusService)
    {
        // Un signalement (bénéficiaire) accepte aussi la photo comme preuve (voir
        // typesDemande.js : fichierFacultatif/accepteVocal) — mais pas de vidéo :
        // ça filmerait l'auxiliaire de vie qui intervient à son domicile, ce
        // qu'on ne veut pas permettre. Le message vocal (voir VoiceRecorder.jsx)
        // peut arriver dans plusieurs formats audio selon ce que le navigateur
        // sait enregistrer (webm la plupart du temps, m4a sur Safari/iOS, qui ne
        // sait pas produire de webm) — tous acceptés, jamais de vidéo. Autorisé
        // sur tous les types de dépôt, pas seulement les signalements : le micro
        // est proposé partout où VoiceRecorder est utilisé.
        $typeDocument = TypeDocument::find($request->input('type_document_id'));
        $estSignalement = $typeDocument && str_starts_with($typeDocument->libelle, 'Signalement');
        $mimesAudio = 'webm,m4a,mp3,wav,ogg';
        // 'extensions' (extension déclarée par le client) plutôt que 'mimes'
        // (type détecté par le contenu, via fileinfo/libmagic) : sur cette
        // machine, un vrai .pptx/.docx (fichiers OOXML = zip) de plusieurs Mo
        // est parfois détecté comme "application/octet-stream" au lieu de son
        // vrai type, ce qui faisait rejeter à tort des fichiers Office
        // légitimes. Moins strict côté sécurité, mais l'upload est déjà
        // réservé à des comptes authentifiés (personnel interne ou dépôt).
        $regleFichier = $estSignalement
            ? "required|file|extensions:pdf,doc,docx,odt,jpg,jpeg,png,{$mimesAudio}|max:51200"
            : "required|file|extensions:pdf,doc,docx,odt,ppt,pptx,odp,csv,xls,xlsx,ods,txt,rtf,zip,jpg,jpeg,png,{$mimesAudio}|max:32048";

        $validatedData = $request->validate([
            'category_id' => 'required|integer|exists:categorie_documents,id',
            'type_document_id' => [
                'required',
                'integer',
                Rule::exists('type_documents', 'id')->where('categorie_id', $request->input('category_id')),
            ],
            'titre' => 'required|string|max:255',
            'auteur' => 'required|string|max:255',
            'resume' => 'nullable|string',
            // Valeur canonique (toujours en français, ex: "Salaire") pour une
            // réclamation — distincte du libellé traduit affiché/injecté dans le PDF,
            // pour permettre de filtrer/grouper de façon fiable quelle que soit la
            // langue active au moment du dépôt.
            'objet' => 'nullable|string|max:100',
            'reference' => 'required|string|max:255',
            'file_create_date' => 'required|integer',
            'duree_conservation_annees' => 'nullable|integer|min:1|max:99',
            'niveau_confidentialite' => 'nullable|string|in:PUBLIC,INTERNE,CONFIDENTIEL,STRICTEMENT_CONFIDENTIEL',
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'nom_personne_concernee' => 'nullable|string|max:255',
            // Texte reconnu par OCR côté navigateur au moment du scan (voir
            // scannerEngine.js), ou transcrit depuis un message vocal (voir
            // VoiceRecorder.jsx) — seulement pour la recherche, jamais affiché
            // comme un champ à part entière.
            'texte_extrait' => 'nullable|string',
            // Champs structurés du formulaire "Nouveau courrier" (voir CourrierForm.jsx)
            // — tous nullable, seul un sous-ensemble est rempli selon sens_courrier.
            'sens_courrier' => 'nullable|string|in:entrant,sortant',
            'type_envoi' => 'nullable|string|max:100',
            'numero_recommande' => 'nullable|string|max:255',
            'nombre_documents' => 'nullable|integer|min:0',
            'date_envoi' => 'nullable|date',
            'date_reception' => 'nullable|date',
            'expediteur_nom' => 'nullable|string|max:255',
            'expediteur_adresse' => 'nullable|string|max:255',
            'destinataire_nom' => 'nullable|string|max:255',
            'destinataire_adresse' => 'nullable|string|max:255',
            'montant' => 'nullable|numeric|min:0',
            // Payé/Prélèvement/Traité ne se choisissent pas à la création : ce sont
            // des états "finaux" posés depuis resoudreCourrier() ci-dessous.
            'etat_courrier' => 'nullable|string|in:En attente,Enregistré,Déposé,N/C',
            'deadline_courrier' => 'nullable|date',
            'file' => $regleFichier,
            // Uniquement pertinent pour un archivage manuel interne (voir plus
            // bas) — un dépôt externe (compte dépôt) suit toujours le circuit
            // de validation complet, ces champs sont ignorés dans ce cas.
            // La règle 'boolean' de Laravel n'accepte que true/false/1/0/"1"/"0"
            // au sens strict — pas la chaîne "true" que FormData.append()
            // envoie forcément depuis le navigateur (tout y est stringifié) :
            // 'in' couvre les deux écritures ; $request->boolean() ci-dessous
            // sait déjà lire "true" correctement.
            'deja_traite' => ['sometimes', Rule::in(['0', '1', 'true', 'false'])],
            'delai_jours' => 'nullable|integer|min:1|max:365',
            // Qui prévenir de ce dépôt : tout le personnel interne, une liste
            // précise, ou personne du tout — 'destinataires_mode' est la source
            // de vérité (un tableau vide, seul, ne suffit pas à distinguer
            // "tous" de "personne", voir DestinatairesNotificationField.jsx).
            'destinataires_mode' => 'nullable|string|in:tous,specifiques,aucune',
            'destinataires_ids' => 'nullable|array',
            'destinataires_ids.*' => 'integer|exists:utilisateurs,id',
        ]);

        // Le gel d'un dossier (voir CategorieController::verrouiller) ne bloque
        // que l'archivage interne — jamais les dépôts externes (réclamation,
        // signalement, congés, prestation), qui passent par ce même endpoint
        // mais ne « parcourent » pas le dossier comme le fait le personnel.
        $utilisateurCourant = auth('api')->user();
        $archivageManuelInterne = !$utilisateurCourant->estCompteDepot();
        if ($archivageManuelInterne) {
            $categorieCible = CategorieDocument::find($validatedData['category_id']);
            if ($categorieCible?->estVerrouille()) {
                return response()->json(['error' => 'Ce dossier est verrouillé — déverrouillez-le avant d\'y archiver un document.'], 423);
            }
        } else {
            // Dépôt externe (bénéficiaire/intervenant, espace/:type) : range
            // automatiquement dans un vrai sous-dossier à son nom (créé au
            // premier dépôt, réutilisé ensuite) plutôt que de laisser le
            // document à plat au niveau du type — c'est ce sous-dossier que
            // le personnel voit et gère depuis OpenFolder, sans qu'un
            // regroupement automatique par rôle ait besoin d'être recalculé
            // à l'affichage.
            $nomPersonne = trim($validatedData['nom_personne_concernee'] ?? '') ?: $utilisateurCourant->nom;
            if ($nomPersonne) {
                $dossierPersonne = TypeDocument::firstOrCreate([
                    'categorie_id' => $validatedData['category_id'],
                    'parent_id' => $validatedData['type_document_id'],
                    'libelle' => $nomPersonne,
                ]);
                $validatedData['type_document_id'] = $dossierPersonne->id;
            }
        }

        // "Déjà traité" n'a de sens que pour un archivage manuel interne (ex: une
        // note de service qu'un membre du personnel classe lui-même) — un dépôt
        // externe (compte dépôt) suit toujours le circuit de validation complet,
        // qui décide seul de quand le document est traité.
        $dejaTraite = $archivageManuelInterne && $request->boolean('deja_traite');
        // La validation 'integer' garantit que la valeur EST numérique, mais ne
        // convertit pas son type PHP — un champ multipart reste une string
        // ("5"), que Carbon::addDays() (typé strictement int|float) refuse.
        $delaiJours = isset($validatedData['delai_jours']) ? (int) $validatedData['delai_jours'] : null;
        $echeanceTraitement = ($archivageManuelInterne && !$dejaTraite && $delaiJours)
            ? now()->addDays($delaiJours)->toDateString()
            : null;
        $statutInitial = $dejaTraite ? StatutDocument::VALIDE_ET_TRAITE->value : StatutDocument::SOUMIS->value;
        // Même restriction que deja_traite/delai_jours : un dépôt externe suit
        // toujours son circuit de validation habituel (tout le personnel
        // interne informé), le choix des destinataires n'a de sens que pour
        // un archivage manuel. null = personnel du service (comportement par
        // défaut) ; [] = personne explicitement ; [ids] = liste précise.
        $destinatairesIds = $archivageManuelInterne
            ? match ($validatedData['destinataires_mode'] ?? 'tous') {
                'aucune' => [],
                'specifiques' => $validatedData['destinataires_ids'] ?? [],
                default => null,
            }
            : null;

        // Un archivage manuel interne n'a plus de sélecteur "Personnel concerné"
        // dans l'interface (redondant avec "Prévenir") — ça remonte directement
        // à la personne qui archive, comme pour un dépôt externe.
        $personnelConcerneId = $validatedData['personnel_concerne_id'] ?? null;
        $nomPersonneConcernee = $validatedData['nom_personne_concernee'] ?? null;
        if ($archivageManuelInterne && empty($personnelConcerneId) && empty($nomPersonneConcernee)) {
            $personnelConcerneId = Personnels::where('utilisateur_id', $utilisateurCourant->id)->value('id');
            if (!$personnelConcerneId) {
                $nomPersonneConcernee = $utilisateurCourant->nom;
            }
        }

        $data = [
            'utilisateur_id' => auth('api')->id(),
            'personnel_concerne_id' => $personnelConcerneId,
            'nom_personne_concernee' => empty($personnelConcerneId) ? $nomPersonneConcernee : null,
            'categorie_id' => $validatedData['category_id'],
            'type_document_id' => $validatedData['type_document_id'],
            'titre_document' => $validatedData['titre'],
            'auteur' => $validatedData['auteur'],
            // Colonne NOT NULL en base : chaîne vide plutôt que null si omis,
            // pas la peine d'une migration pour un champ qui n'a aucune
            // raison d'être obligatoire (une "Note de service" n'a pas
            // toujours besoin d'un résumé écrit en plus du fichier).
            'resume' => $validatedData['resume'] ?? '',
            'objet' => $validatedData['objet'] ?? null,
            'texte_extrait' => $validatedData['texte_extrait'] ?? null,
            'code_reference' => $validatedData['reference'],
            'duree_conservation_annees' => $validatedData['duree_conservation_annees'] ?? 5,
            'niveau_confidentialite' => $validatedData['niveau_confidentialite'] ?? 'INTERNE',
            'echeance_traitement_le' => $echeanceTraitement,
            // Champs structurés "Nouveau courrier" (voir CourrierForm.jsx) — nuls
            // pour tout document qui n'est pas un courrier.
            'sens_courrier' => $validatedData['sens_courrier'] ?? null,
            'type_envoi' => $validatedData['type_envoi'] ?? null,
            'numero_recommande' => $validatedData['numero_recommande'] ?? null,
            'nombre_documents' => $validatedData['nombre_documents'] ?? null,
            'date_envoi' => $validatedData['date_envoi'] ?? null,
            'date_reception' => $validatedData['date_reception'] ?? null,
            'expediteur_nom' => $validatedData['expediteur_nom'] ?? null,
            'expediteur_adresse' => $validatedData['expediteur_adresse'] ?? null,
            'destinataire_nom' => $validatedData['destinataire_nom'] ?? null,
            'destinataire_adresse' => $validatedData['destinataire_adresse'] ?? null,
            'montant' => $validatedData['montant'] ?? null,
            'etat_courrier' => $validatedData['etat_courrier'] ?? null,
            'deadline_courrier' => $validatedData['deadline_courrier'] ?? null,
            // Il n'y a pas d'étape "brouillon" : un document déposé est directement soumis
            // à validation (sauf archivage manuel interne marqué "déjà traité", qui saute
            // directement à l'étape finale), sans action manuelle supplémentaire de l'archiviste.
            'status_doc' => $statutInitial,
        ];

        if ($request->hasFile('file')) {
            $file = $request->file('file');
            $contenu = file_get_contents($file->getRealPath());
            // Extension déclarée par le client, pas $file->extension() (déduite du
            // type MIME détecté par le contenu) : un vrai .pptx/.docx volumineux se
            // fait parfois détecter comme "application/octet-stream" sur cette
            // machine (voir la règle 'extensions' plus haut, même raison), ce qui
            // ferait enregistrer le fichier sous une extension ".bin" erronée.
            $extension = strtolower($file->getClientOriginalExtension());
            $nomFichier = $data['titre_document'] . '.' . $extension;
            // Dossier basé sur les identifiants (stables), jamais sur le libellé
            // affiché (modifiable) — renommer une catégorie ou un type ne doit
            // jamais nécessiter de déplacer les fichiers déjà archivés.
            $dossier = "categorie_{$data['categorie_id']}/type_{$data['type_document_id']}";
            $chemin = $dossier . '/' . $nomFichier;

            Storage::disk(config('filesystems.document_disk'))->makeDirectory($dossier);
            Storage::disk(config('filesystems.document_disk'))->put($chemin, $contenu);

            $data['nom_fichier_original'] = $file->getClientOriginalName();
            $data['chemin_stockage_serveur'] = $chemin;
            // Même logique : le type MIME "canonique" de l'extension déclarée,
            // pas celui détecté par le contenu — sinon le fichier téléchargé plus
            // tard serait servi avec un Content-Type application/octet-stream au
            // lieu du vrai type (le navigateur proposerait un téléchargement brut
            // au lieu d'ouvrir l'aperçu).
            $data['format_mime'] = \Symfony\Component\Mime\MimeTypes::getDefault()->getMimeTypes($extension)[0] ?? $file->getMimeType();
            $data['taille'] = $file->getSize();
            $data['checksum_sha256'] = hash('sha256', $contenu);
            // Le front envoie File.lastModified, en millisecondes — pas des secondes.
            $data['file_create_date'] = \Carbon\Carbon::createFromTimestampMs($validatedData['file_create_date'])->toDateString();
        }

        try {
            DB::beginTransaction();
            $document = DocumentArchive::create($data);

            HistoriqueStatut::create([
                'document_archive_id' => $document->id,
                'utilisateur_id' => auth('api')->id(),
                'ancien_statut' => null,
                'nouveau_statut' => $statutInitial,
                'date_changement' => now(),
                'motif_changement' => $dejaTraite ? 'Archivé directement (déjà traité)' : 'Dépôt du document',
            ]);

            DB::commit();

            // Même "déjà traité" (rien à valider), on prévient qui a été choisi —
            // notifierValidateurs() adapte le contenu de la notification selon
            // $dejaTraite pour ne jamais laisser croire à une action attendue.
            $documentStatusService->notifierValidateurs($document, null, $destinatairesIds, $dejaTraite);
            broadcast(new DocumentStatutMisAJour($document));

            return response()->json(['message' => 'Document créé avec succès', 'document' => $document], 201);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "L'enregistrement du document a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    /**
     * Partage un document, soit avec un collègue (personnel de l'application),
     * soit par email avec un particulier externe. Dans les deux cas, l'envoi
     * se fait par e-mail, avec le document en pièce jointe.
     */
    public function share(Request $request, DocumentArchive $document)
    {
        if (!$this->documentEstVisiblePar($document, auth('api')->user())) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

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
            $share = $document->shares()->create([
                'utilisateur_id' => $expediteur->id,
                'destinataire_utilisateur_id' => $isExternal ? null : $destinataire->id,
                'email_destinataire' => $isExternal ? $emailDestination : null,
                'type_partage' => $isExternal ? 'email' : 'interne',
                'message' => $message,
                'permissions' => 'read',
            ]);

            if ($isExternal) {
                // Partage externe : jamais de pièce jointe, un lien sécurisé protégé
                // par un code à usage unique (voir Share::genererAccesExterne()).
                $token = $share->genererAccesExterne();
                $lien = rtrim(config('app.frontend_url'), '/') . '/partage/' . $token;

                Mail::to($emailDestination)->send(new DocumentSharedExternalMail(
                    $document,
                    $expediteur->nom,
                    $message,
                    $lien
                ));
            } else {
                Mail::to($emailDestination)->send(new DocumentSharedMail(
                    $document,
                    $expediteur->nom,
                    $message,
                    false
                ));
                $destinataire->notify(new DocumentSharedNotification($document, $expediteur->nom, $message));
            }

            return response()->json(['message' => 'Document partagé avec succès.'], 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "L'envoi du document a échoué. Réessayez dans quelques instants."], 500);
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

    /**
     * Épingle un document en favori pour l'utilisateur connecté — même
     * mécanisme que CategorieController::favorite() (relation polymorphique
     * Favorite, déjà exposée par DocumentArchive::favorites()).
     */
    public function favorite(Request $request, DocumentArchive $document)
    {
        $document->favorites()->firstOrCreate(['utilisateur_id' => auth('api')->id()]);

        return response()->json(['message' => 'Document épinglé avec succès.']);
    }

    public function unfavorite(Request $request, DocumentArchive $document)
    {
        $document->favorites()->where('utilisateur_id', auth('api')->id())->delete();

        return response()->json(['message' => 'Document retiré des favoris.']);
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
        $user = auth('api')->user();

        if (!$this->documentEstVisiblePar($document, $user)) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        // 'typeDocument.parent' : un dépôt externe (voir store() ci-dessus) est
        // maintenant rangé dans un vrai sous-dossier au nom du déposant, pas
        // directement dans le type demandé (ex: "Demande de congés") — le
        // frontend a besoin du parent pour reconnaître le type réel malgré
        // cette imbrication (voir estDemandeDeConges/estReclamation/
        // estDemandePaie dans DocView.jsx).
        $document->load('utilisateur', 'categorieDocument', 'typeDocument.parent', 'personnelConcerne', 'suiviDelaiActif.etapeWorkflow', 'verrouillePar');
        $document->is_favorite = $document->favorites()->where('utilisateur_id', $user->id)->exists();

        return response()->json($document, 200);
    }

    /**
     * Liens signés à durée limitée (2h) vers le fichier — show()/downloadVersion()
     * exigent une signature valide et ne peuvent pas porter d'en-tête Authorization
     * (ils sont utilisés en src/href direct par le navigateur : balise <img>,
     * <iframe>, lien de téléchargement). La visibilité est donc vérifiée ici, une
     * fois, avant de délivrer un lien qui contourne ensuite l'authentification
     * classique — sans ça, le fichier serait accessible à quiconque devine l'ID.
     */
    public function lienFichier(DocumentArchive $document)
    {
        if (!$this->documentEstVisiblePar($document, auth('api')->user())) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        return response()->json([
            'affichage' => URL::temporarySignedRoute('documents.show', now()->addHours(2), ['doc_id' => $document->id]),
            'telechargement' => URL::temporarySignedRoute('documents.show', now()->addHours(2), ['doc_id' => $document->id, 'download' => 1]),
        ], 200);
    }

    /**
     * Même principe que lienFichier(), pour le téléchargement d'une ancienne version.
     */
    public function lienFichierVersion(DocumentArchive $document, int $versionId)
    {
        if (!$this->documentEstVisiblePar($document, auth('api')->user())) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        $document->versions()->where('id', $versionId)->firstOrFail();

        return response()->json([
            'telechargement' => URL::temporarySignedRoute('documents.versions.download', now()->addHours(2), ['document' => $document->id, 'versionId' => $versionId]),
        ], 200);
    }

    /**
     * Liste des anciennes versions du fichier (avant chaque remplacement).
     */
    public function versions(DocumentArchive $document)
    {
        if (!$this->documentEstVisiblePar($document, auth('api')->user())) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        return response()->json($document->versions()->with('utilisateur')->get(), 200);
    }

    /**
     * Remplace le fichier d'un document déjà archivé : l'ancien fichier est conservé
     * (chemin distinct sur le disque) et référencé dans document_versions, afin de
     * pouvoir être retéléchargé après remplacement.
     */
    public function newVersion(Request $request, DocumentArchive $document)
    {
        $utilisateur = auth('api')->user();
        if (!$this->documentEstVisiblePar($document, $utilisateur)) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        $validated = $request->validate([
            'file' => 'required|file|extensions:pdf,doc,docx,odt,ppt,pptx,odp,csv,xls,xlsx,ods,txt,rtf,zip,jpg,jpeg,png|max:32048',
            'type_version' => 'nullable|string|in:majeure,mineure',
        ]);

        if ($erreur = $this->verifierVerrou($document, $utilisateur)) {
            return response()->json(['error' => $erreur], 409);
        }

        try {
            $document = $this->remplacerFichier($document, $request->file('file'), $utilisateur->id, $validated['type_version'] ?? 'mineure');
            return response()->json($document, 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "Le remplacement du fichier a échoué. Réessayez dans quelques instants."], 500);
        }
    }

    /**
     * Permet au déposant d'un document REJETÉ de le corriger lui-même (remplacer
     * le fichier) et de le renvoyer directement vers SOUMIS — sans passer par les
     * permissions internes (archiver_documents/valider_documents, réservées au
     * personnel) : strictement limité à son propre document, et seulement s'il
     * est bien au statut rejeté, donc sans risque d'usage détourné.
     */
    public function corrigerEtRenvoyer(Request $request, DocumentArchive $document, DocumentStatusService $service)
    {
        $utilisateur = auth('api')->user();

        if ((int) $document->utilisateur_id !== (int) $utilisateur->id) {
            return response()->json(['error' => "Vous ne pouvez corriger que vos propres documents."], 403);
        }

        if ($document->status_doc !== StatutDocument::INCOMPLET_REJETE->value) {
            return response()->json(['error' => "Ce document n'est pas en attente de correction."], 422);
        }

        $request->validate([
            'file' => 'required|file|extensions:pdf,doc,docx,odt,ppt,pptx,odp,csv,xls,xlsx,ods,txt,rtf,zip,jpg,jpeg,png|max:32048',
        ]);

        if ($erreur = $this->verifierVerrou($document, $utilisateur)) {
            return response()->json(['error' => $erreur], 409);
        }

        try {
            // Toujours mineure : c'est une correction du même dépôt, pas un
            // nouveau document — le compteur majeur ne bouge pas.
            $document = $this->remplacerFichier($document, $request->file('file'), $utilisateur->id, 'mineure');
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "La correction a échoué. Réessayez dans quelques instants."], 500);
        }

        try {
            $document = $service->transitionTo($document, StatutDocument::SOUMIS->value, 'Corrigé et renvoyé par le déposant');
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => "Le fichier a été remplacé mais le renvoi a échoué. Contactez le service concerné."], 500);
        }

        return response()->json($document, 200);
    }

    /**
     * Archive la version courante puis remplace le fichier stocké — logique
     * partagée par newVersion() (personnel), corrigerEtRenvoyer() (déposant) et
     * decisionConges(). `$typeVersion` ('majeure'|'mineure') détermine comment le
     * label de version (ex: "2.3") évolue : une majeure incrémente l'entier et
     * remet le mineur à 0, une mineure incrémente juste le mineur.
     */
    private function remplacerFichier(DocumentArchive $document, $file, int $utilisateurId, string $typeVersion = 'mineure'): DocumentArchive
    {
        return DB::transaction(function () use ($document, $file, $utilisateurId, $typeVersion) {
            $prochainNumero = $document->versions()->count() + 1;

            // Le cliché archivé porte le label QU'AVAIT le fichier avant ce
            // remplacement — le nouveau label n'est calculé qu'après.
            DocumentVersion::create([
                'document_archive_id' => $document->id,
                'numero_version' => $prochainNumero,
                'type_version' => $typeVersion,
                'numero_majeur' => $document->version_majeure,
                'numero_mineur' => $document->version_mineure,
                'utilisateur_id' => $utilisateurId,
                'nom_fichier_original' => $document->nom_fichier_original,
                'chemin_stockage_serveur' => $document->chemin_stockage_serveur,
                'format_mime' => $document->format_mime,
                'taille' => $document->taille,
                'checksum_sha256' => $document->checksum_sha256,
            ]);

            $contenu = file_get_contents($file->getRealPath());
            $dossier = "categorie_{$document->categorie_id}/type_{$document->type_document_id}";
            // Extension déclarée par le client, pas $file->extension() — voir
            // store() plus haut, même raison (fileinfo détecte parfois un vrai
            // .pptx/.docx volumineux comme "application/octet-stream").
            $extension = strtolower($file->getClientOriginalExtension());
            $nomFichier = uniqid('v' . ($prochainNumero + 1) . '_') . '.' . $extension;
            $chemin = $dossier . '/' . $nomFichier;

            Storage::disk(config('filesystems.document_disk'))->makeDirectory($dossier);
            Storage::disk(config('filesystems.document_disk'))->put($chemin, $contenu);

            $document->update([
                'nom_fichier_original' => $file->getClientOriginalName(),
                'chemin_stockage_serveur' => $chemin,
                'format_mime' => \Symfony\Component\Mime\MimeTypes::getDefault()->getMimeTypes($extension)[0] ?? $file->getMimeType(),
                'taille' => $file->getSize(),
                'checksum_sha256' => hash('sha256', $contenu),
                'version_majeure' => $typeVersion === 'majeure' ? $document->version_majeure + 1 : $document->version_majeure,
                'version_mineure' => $typeVersion === 'majeure' ? 0 : $document->version_mineure + 1,
                // Le remplacement est l'action même que le verrou protégeait —
                // il se relâche automatiquement une fois faite, pas besoin d'un
                // appel séparé à déverrouiller().
                'verrouille_par_utilisateur_id' => null,
                'verrouille_le' => null,
            ]);

            return $document->fresh();
        });
    }

    /**
     * `null` si l'utilisateur peut remplacer le fichier, sinon le message
     * d'erreur à renvoyer. Un verrou expiré (30 min sans action) est traité
     * comme relâché.
     */
    private function verifierVerrou(DocumentArchive $document, Utilisateurs $utilisateur): ?string
    {
        if (!$document->estVerrouille()) {
            return null;
        }
        if ((int) $document->verrouille_par_utilisateur_id === (int) $utilisateur->id) {
            return null;
        }
        if ($utilisateur->estAdministrateur()) {
            return null;
        }

        $nom = $document->verrouillePar?->nom ?? 'un autre utilisateur';
        return "Ce document est verrouillé par {$nom}. Réessayez une fois qu'il/elle aura terminé.";
    }

    /**
     * Pose un verrou pessimiste avant de remplacer un fichier, pour éviter que
     * deux personnes le fassent en même temps sans le savoir.
     */
    public function verrouiller(DocumentArchive $document)
    {
        $utilisateur = auth('api')->user();
        if (!$this->documentEstVisiblePar($document, $utilisateur)) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        if ($erreur = $this->verifierVerrou($document, $utilisateur)) {
            return response()->json(['error' => $erreur], 409);
        }

        $document->update(['verrouille_par_utilisateur_id' => $utilisateur->id, 'verrouille_le' => now()]);
        return response()->json($document->fresh('verrouillePar'), 200);
    }

    /**
     * Relâche un verrou — seul celui qui l'a posé ou un administrateur peut le faire.
     */
    public function deverrouiller(DocumentArchive $document)
    {
        $utilisateur = auth('api')->user();
        if (!$this->documentEstVisiblePar($document, $utilisateur)) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        if (
            $document->verrouille_par_utilisateur_id
            && (int) $document->verrouille_par_utilisateur_id !== (int) $utilisateur->id
            && !$utilisateur->estAdministrateur()
        ) {
            $nom = $document->verrouillePar?->nom ?? 'la personne ayant verrouillé';
            return response()->json(['error' => "Seul(e) {$nom} ou un administrateur peut déverrouiller ce document."], 403);
        }

        $document->update(['verrouille_par_utilisateur_id' => null, 'verrouille_le' => null]);
        return response()->json($document->fresh(), 200);
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
            'resume' => 'nullable|string',
            'reference' => 'required|string|max:255',
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'nom_personne_concernee' => 'nullable|string|max:255',
        ]);

        try {
            $document = DocumentArchive::findOrFail($doc_id);
            $utilisateurCourant = auth('api')->user();

            if (!$this->documentEstVisiblePar($document, $utilisateurCourant)) {
                return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
            }

            $nouveauTypeId = $validatedData['type_document_id'] ?? $document->type_document_id;
            $seDeplace = (int) $document->categorie_id !== (int) $validatedData['category_id']
                || (int) $document->type_document_id !== (int) $nouveauTypeId;

            if ($seDeplace && !$utilisateurCourant->estCompteDepot()) {
                $categorieSource = CategorieDocument::find($document->categorie_id);
                $categorieCible = CategorieDocument::find($validatedData['category_id']);
                if ($categorieSource?->estVerrouille() || $categorieCible?->estVerrouille()) {
                    return response()->json(['error' => 'Le dossier de départ ou de destination est verrouillé — déverrouillez-le avant de déplacer ce document.'], 423);
                }
            }

            $donneesMaj = [
                'categorie_id' => $validatedData['category_id'],
                'type_document_id' => $validatedData['type_document_id'] ?? $document->type_document_id,
                'titre_document' => $validatedData['titre'],
                'auteur' => $validatedData['auteur'],
                'resume' => $validatedData['resume'] ?? '',
                'code_reference' => $validatedData['reference'],
            ];
            // Champ retiré du formulaire de modification (redondant avec "Prévenir") —
            // on ne le touche que si explicitement envoyé, pour ne pas écraser la
            // valeur déterminée à l'archivage à chaque renommage.
            if ($request->has('personnel_concerne_id') || $request->has('nom_personne_concernee')) {
                $donneesMaj['personnel_concerne_id'] = $validatedData['personnel_concerne_id'] ?? null;
                $donneesMaj['nom_personne_concernee'] = empty($validatedData['personnel_concerne_id']) ? ($validatedData['nom_personne_concernee'] ?? null) : null;
            }
            $document->update($donneesMaj);

            return response()->json($document, 200);
        } catch (\Throwable $th) {
            report($th);
            return response()->json(['error' => 'La mise à jour a échoué. Réessayez dans quelques instants.'], 500);
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

            if (!$this->documentEstVisiblePar($document, auth('api')->user())) {
                DB::rollback();
                return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
            }

            $document->delete();
            DB::commit();
            return response()->json(['message' => 'Document envoyé à la corbeille'], 200);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "La suppression a échoué. Réessayez dans quelques instants."], 500);
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
            report($th);
            return response()->json(['error' => "La restauration a échoué. Réessayez dans quelques instants."], 500);
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
            report($th);
            return response()->json(['error' => "La suppression définitive a échoué. Réessayez dans quelques instants."], 500);
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
        $user = auth('api')->user();
        $seuilAttente = now()->subDays(7);
        $dernierChangement = HistoriqueStatut::selectRaw('document_archive_id, MAX(date_changement) as derniere_date')
            ->groupBy('document_archive_id');

        $enAttenteQuery = DocumentArchive::query()
            ->whereIn('status_doc', [
                StatutDocument::SOUMIS->value,
                StatutDocument::TRANSMIS_AU_SERVICE->value,
                StatutDocument::EN_COURS_DE_TRAITEMENT->value,
            ])
            ->joinSub($dernierChangement, 'derniers', function ($join) {
                $join->on('document_archives.id', '=', 'derniers.document_archive_id');
            })
            ->where('derniers.derniere_date', '<=', $seuilAttente);
        $this->restreindreParVisibilite($enAttenteQuery, $user);
        $enAttente = $enAttenteQuery
            ->orderBy('derniers.derniere_date')
            ->limit(5)
            ->get(['document_archives.*', 'derniers.derniere_date']);

        $seuilPurge = now()->addDays(90);
        $aPurgerQuery = DocumentArchive::query()
            ->whereIn('status_doc', [StatutDocument::ARCHIVE->value, StatutDocument::EXPIRE_A_PURGER->value])
            ->whereNotNull('date_archivage')
            ->whereNotNull('duree_conservation_annees')
            ->whereRaw('DATE_ADD(date_archivage, INTERVAL duree_conservation_annees YEAR) <= ?', [$seuilPurge]);
        $this->restreindreParVisibilite($aPurgerQuery, $user);
        $aPurger = $aPurgerQuery
            ->orderByRaw('DATE_ADD(date_archivage, INTERVAL duree_conservation_annees YEAR) ASC')
            ->limit(5)
            ->get();

        // Échéance de traitement posée manuellement à l'archivage (voir store(),
        // champ delai_jours) — approchée (3 jours) ou déjà dépassée, sur un
        // document pas encore validé.
        $echeanceQuery = DocumentArchive::query()
            ->whereNotNull('echeance_traitement_le')
            ->whereIn('status_doc', [
                StatutDocument::SOUMIS->value,
                StatutDocument::TRANSMIS_AU_SERVICE->value,
                StatutDocument::EN_COURS_DE_TRAITEMENT->value,
            ])
            ->where('echeance_traitement_le', '<=', now()->addDays(3));
        $this->restreindreParVisibilite($echeanceQuery, $user);
        $echeanceProche = $echeanceQuery->orderBy('echeance_traitement_le')->limit(5)->get();

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
            'echeance_traitement' => $echeanceProche->map(fn ($d) => [
                'id' => $d->id,
                'titre' => $d->titre_document,
                'extension' => pathinfo($d->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION),
                'echeance' => $d->echeance_traitement_le?->toDateString(),
                'depassee' => $d->echeance_traitement_le && $d->echeance_traitement_le->isPast(),
            ]),
        ], 200);
    }

    /**
     * Fait transitionner le document vers un nouveau statut du workflow.
     */
    public function transition(Request $request, DocumentArchive $document, DocumentStatusService $service)
    {
        $utilisateur = auth('api')->user();
        if (!$this->documentEstVisiblePar($document, $utilisateur)) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }
        if (!$service->peutValider($document, $utilisateur)) {
            return response()->json(['error' => "Ce document n'appartient pas à votre service — vous pouvez le consulter, mais pas le traiter."], 403);
        }

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
     * Résout un courrier entrant (voir CourrierForm.jsx) : les états "finaux"
     * (Payé/Prélèvement/Traité — distincts des états "en cours" proposés à la
     * saisie du formulaire) valent traitement terminé, donc on archive le
     * document dans la foulée exactement comme "Validé et traité" le ferait
     * pour un document classique, plutôt que de laisser deux actions séparées
     * à faire à la main.
     */
    public function resoudreCourrier(Request $request, DocumentArchive $document, DocumentStatusService $service)
    {
        $utilisateur = auth('api')->user();
        if (!$this->documentEstVisiblePar($document, $utilisateur)) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        // Restriction volontairement plus étroite que peutValider() (qui
        // autoriserait tout éditeur du service propriétaire) : le traitement
        // d'un courrier reste réservé aux Administrateurs et aux rôles ayant
        // la permission dédiée traiter_courrier (Comptabilité/Paie par
        // défaut, voir RoleSeeder — gérable depuis "Gérer les permissions"
        // sans toucher au code, par ex. pour l'ouvrir à un Responsable Secteur).
        $autorise = $utilisateur->estAdministrateur() || $utilisateur->hasPermission('traiter_courrier');
        if (!$autorise) {
            return response()->json(['error' => "Seuls les administrateurs et le personnel Comptabilité/Paie peuvent traiter un courrier."], 403);
        }

        $validated = $request->validate([
            'etat_courrier' => 'required|string|in:Payé,Prélèvement,Traité',
        ]);

        try {
            $document->update(['etat_courrier' => $validated['etat_courrier']]);
            $document = $service->transitionTo($document, 'VALIDE_ET_TRAITE');
            return response()->json($document, 200);
        } catch (InvalidArgumentException $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Compteur agrégé pour la tuile du tableau de bord (Home.jsx) — courriers
     * entrants encore "En attente" de traitement, même public que ce droit
     * (voir resoudreCourrier() : Administrateurs + traiter_courrier).
     */
    public function courrierCompteurs()
    {
        $enAttente = DocumentArchive::where('sens_courrier', 'entrant')
            ->where('etat_courrier', 'En attente')
            ->count();

        return response()->json(['en_attente' => $enAttente], 200);
    }

    /**
     * Analyse IA d'un fichier tout juste sélectionné, AVANT tout archivage —
     * appelé depuis ArchiverDocumentModal.jsx pour proposer titre/résumé/
     * référence/texte extrait, que l'utilisateur reste libre de modifier ou
     * ignorer avant de soumettre le vrai formulaire d'archivage (POST
     * /documents). Ne persiste rien : une simple suggestion, jamais un
     * document. Renvoie 200 avec des champs vides si l'IA n'est pas
     * configurée ou échoue — jamais une erreur qui bloquerait l'archivage
     * manuel classique.
     */
    public function analyserIa(Request $request, DocumentAnalysisIAService $service)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,jpg,jpeg,png|max:32048',
        ]);

        $file = $request->file('file');
        $mimeType = \Symfony\Component\Mime\MimeTypes::getDefault()->getMimeTypes($file->getClientOriginalExtension())[0] ?? $file->getMimeType();
        $contenuBase64 = base64_encode(file_get_contents($file->getRealPath()));

        $resultat = $service->analyserFichier($contenuBase64, $mimeType);

        return response()->json($resultat ?? [
            'titre_suggere' => null,
            'resume_suggere' => null,
            'reference_suggeree' => null,
            'texte_extrait' => null,
        ], 200);
    }

    /**
     * Suggère à quel(s) service(s) transmettre un document déjà archivé, à
     * partir de son contenu déjà en base — pas de re-upload. Utilisé depuis
     * le panneau "Transmettre à un service" de DocView.jsx : ne fait que
     * pré-cocher des cases, la transmission elle-même reste un geste manuel
     * (voir DocumentAnalysisIAService::suggererTransmission()).
     */
    public function suggererTransmission(DocumentArchive $document, DocumentAnalysisIAService $service)
    {
        $utilisateur = auth('api')->user();
        if (!$this->documentEstVisiblePar($document, $utilisateur)) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        $resultat = $service->suggererTransmission($document);

        return response()->json($resultat ?? ['service_codes' => [], 'justification' => null], 200);
    }

    /**
     * Cas particulier d'une "Demande de congés" : au lieu d'une simple
     * transition de statut, le responsable secteur envoie directement le PDF
     * complété (section 3 "Décision de l'employeur" incrustée côté client,
     * voir congesPdf.js) — remplace le fichier, fait transitionner le statut,
     * puis envoie ce PDF final par e-mail au demandeur.
     */
    public function decisionConges(Request $request, DocumentArchive $document, DocumentStatusService $service)
    {
        $utilisateur = auth('api')->user();
        if (!$this->documentEstVisiblePar($document, $utilisateur)) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }
        if (!$service->peutValider($document, $utilisateur)) {
            return response()->json(['error' => "Ce document n'appartient pas à votre service — vous pouvez le consulter, mais pas le traiter."], 403);
        }

        $validated = $request->validate([
            'file' => 'required|file|extensions:pdf|max:32048',
            'nouveau_statut' => 'required|string|in:VALIDE_ET_TRAITE,INCOMPLET_REJETE',
            'motif' => 'nullable|string',
            'nom_signataire' => 'required|string|max:255',
        ]);

        if ($erreur = $this->verifierVerrou($document, $utilisateur)) {
            return response()->json(['error' => $erreur], 409);
        }

        try {
            DB::beginTransaction();
            // Toujours majeure : c'est la version définitive du document (décision
            // de l'employeur incluse), pas un simple ajustement.
            $document = $this->remplacerFichier($document, $request->file('file'), $utilisateur->id, 'majeure');
            $document = $service->transitionTo($document, $validated['nouveau_statut'], $validated['motif'] ?? null);
            DB::commit();
        } catch (InvalidArgumentException $e) {
            DB::rollback();
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "L'enregistrement de la décision a échoué. Réessayez dans quelques instants."], 500);
        }

        // Envoi au demandeur — best-effort : la décision est déjà enregistrée,
        // un souci d'e-mail (SMTP indisponible...) ne doit pas la faire échouer.
        try {
            $destinataire = $document->utilisateur;
            if ($destinataire?->mail) {
                Mail::to($destinataire->mail)->send(new CongeDecisionMail($document, $validated['nom_signataire'], $validated['motif'] ?? null));
            }
        } catch (\Throwable $th) {
            report($th);
        }

        return response()->json($document, 200);
    }

    /**
     * Cas particulier d'une "Demande de fiche de paie" (voir PaieForm.jsx) :
     * la Compta envoie le vrai bulletin en réponse — remplace le PDF
     * récapitulatif de la demande par ce fichier, range le document dans le
     * vrai dossier "Bulletin de paie" (sous-dossier au nom du salarié, créé
     * au besoin — même mécanisme que l'archivage automatique d'un dépôt
     * externe, voir store() ci-dessus), puis marque la demande traitée — le
     * salarié la retrouve alors avec le vrai fichier, sans étape de partage
     * supplémentaire, puisque `utilisateur_id` ne change jamais.
     */
    public function decisionPaie(Request $request, DocumentArchive $document, DocumentStatusService $service)
    {
        $utilisateur = auth('api')->user();
        if (!$this->documentEstVisiblePar($document, $utilisateur)) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }
        if (!$service->peutValider($document, $utilisateur)) {
            return response()->json(['error' => "Ce document n'appartient pas à votre service — vous pouvez le consulter, mais pas le traiter."], 403);
        }

        $request->validate([
            'file' => 'required|file|extensions:pdf|max:32048',
        ]);

        if ($erreur = $this->verifierVerrou($document, $utilisateur)) {
            return response()->json(['error' => $erreur], 409);
        }

        $categorieBulletin = CategorieDocument::where('code', 'ComptpaieFinance')->first();
        $typeBulletin = $categorieBulletin
            ? TypeDocument::where('categorie_id', $categorieBulletin->id)->whereNull('parent_id')->where('libelle', 'Bulletin de paie')->first()
            : null;

        if ($typeBulletin?->categorieDocument?->estVerrouille()) {
            return response()->json(['error' => 'Le dossier "Bulletin de paie" est verrouillé — déverrouillez-le avant d\'envoyer cette fiche de paie.'], 423);
        }

        try {
            DB::beginTransaction();

            if ($typeBulletin) {
                $nomPersonne = trim((string) $document->nom_personne_concernee) ?: $document->utilisateur?->nom;
                if ($nomPersonne) {
                    $dossierPersonne = TypeDocument::firstOrCreate([
                        'categorie_id' => $typeBulletin->categorie_id,
                        'parent_id' => $typeBulletin->id,
                        'libelle' => $nomPersonne,
                    ]);
                    // Avant remplacerFichier() : le nouveau fichier doit être stocké
                    // sous le dossier final, pas sous celui de la demande d'origine.
                    $document->categorie_id = $typeBulletin->categorie_id;
                    $document->type_document_id = $dossierPersonne->id;
                    $document->save();
                }
            }

            // Toujours majeure : c'est le document final (le vrai bulletin),
            // pas un simple ajustement du PDF de demande.
            $document = $this->remplacerFichier($document, $request->file('file'), $utilisateur->id, 'majeure');
            $document = $service->transitionTo($document, 'VALIDE_ET_TRAITE');
            DB::commit();
        } catch (InvalidArgumentException $e) {
            DB::rollback();
            return response()->json(['error' => $e->getMessage()], 422);
        } catch (\Throwable $th) {
            DB::rollback();
            report($th);
            return response()->json(['error' => "L'enregistrement a échoué. Réessayez dans quelques instants."], 500);
        }

        return response()->json($document, 200);
    }

    /**
     * Historique des changements de statut du document.
     */
    public function historique(DocumentArchive $document)
    {
        if (!$this->documentEstVisiblePar($document, auth('api')->user())) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

        return response()->json($document->historiqueStatuts, 200);
    }

    /**
     * Personnes ayant consulté le document (une entrée par utilisateur, voir la
     * contrainte unique sur consultations.utilisateur_id+document_id : ceci reflète
     * la première consultation de chacun, pas un journal de chaque ouverture).
     */
    public function consultations(DocumentArchive $document)
    {
        if (!$this->documentEstVisiblePar($document, auth('api')->user())) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

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
        if (!$this->documentEstVisiblePar($document, auth('api')->user())) {
            return response()->json(['error' => "Vous n'avez pas accès à ce document."], 403);
        }

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
            report($th);
            return response()->json(['error' => "La récupération des données a échoué. Réessayez dans quelques instants."], 500);
        }
    }
}
