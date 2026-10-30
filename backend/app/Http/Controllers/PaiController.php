<?php

namespace App\Http\Controllers;

use App\Models\CategorieDocument;
use App\Models\PaiDossier;
use App\Models\PaiObjectif;
use App\Models\Utilisateurs;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Suivi des PAI (Projets d'Accompagnement Individualisé) — des dossiers qui
 * ne se ferment jamais automatiquement (contrairement à DocumentArchive),
 * avec des objectifs échéancés dont le retard déclenche une alerte. Voir
 * la réunion qualité du 2026-08-16.
 */
class PaiController extends Controller
{
    /** Catégorie par défaut d'un PAI — voir CategorieDocumentSeeder. */
    public const LIBELLE_CATEGORIE_DEFAUT = 'Gestion bénéficiaires & secteur';

    /**
     * Un utilisateur avec une supervision transverse (secrétariat général) voit
     * tous les dossiers ; un responsable de secteur ne voit que les siens.
     */
    private function aSupervisionTransverse(Utilisateurs $utilisateur): bool
    {
        if ($utilisateur->estAdministrateur()) {
            return true;
        }
        return $utilisateur->roles()->where('code_role', 'EDITOR_ADMINISTRATIF')->exists();
    }

    public function index(Request $request)
    {
        $utilisateur = auth('api')->user();

        $requete = PaiDossier::with(['beneficiaire', 'responsableSecteur', 'objectifs']);

        if (!$this->aSupervisionTransverse($utilisateur)) {
            $requete->where('responsable_secteur_id', $utilisateur->id);
        }

        if ($request->boolean('cloture')) {
            $requete->whereNotNull('date_cloture');
        } else {
            $requete->whereNull('date_cloture');
        }

        $dossiers = $requete->orderByDesc('created_at')->get()->map(function (PaiDossier $dossier) {
            return $this->formaterDossier($dossier);
        });

        return response()->json($dossiers, 200);
    }

    public function show(int $id)
    {
        $utilisateur = auth('api')->user();
        $dossier = PaiDossier::with(['beneficiaire', 'responsableSecteur', 'creePar', 'objectifs.realisePar', 'protocoleMajPar'])->findOrFail($id);

        if (!$this->aSupervisionTransverse($utilisateur) && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }

        return response()->json($this->formaterDossier($dossier, true), 200);
    }

    public function store(Request $request)
    {
        $utilisateur = auth('api')->user();

        $validated = $request->validate([
            'titre' => 'required|string|max:255|unique:pai_dossiers,titre',
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'nom_beneficiaire' => 'nullable|string|max:255',
            'responsable_secteur_id' => 'required|integer|exists:utilisateurs,id',
            'description' => 'nullable|string',
            'date_ouverture' => 'nullable|date',
        ], [
            'titre.unique' => 'Un dossier PAI porte déjà ce titre — choisissez-en un autre.',
        ]);

        if (empty($validated['personnel_concerne_id']) && empty($validated['nom_beneficiaire'])) {
            return response()->json(['error' => 'Indiquez le bénéficiaire concerné (nom, ou compte existant).'], 422);
        }

        $categorieId = CategorieDocument::where('libelle_cat', self::LIBELLE_CATEGORIE_DEFAUT)->value('id');
        if (!$categorieId) {
            return response()->json(['error' => "Catégorie \"" . self::LIBELLE_CATEGORIE_DEFAUT . "\" introuvable — contactez un administrateur."], 500);
        }

        $dossier = PaiDossier::create([
            'titre' => $validated['titre'],
            'personnel_concerne_id' => $validated['personnel_concerne_id'] ?? null,
            'nom_beneficiaire' => empty($validated['personnel_concerne_id']) ? ($validated['nom_beneficiaire'] ?? null) : null,
            'responsable_secteur_id' => $validated['responsable_secteur_id'],
            'categorie_id' => $categorieId,
            'description' => $validated['description'] ?? null,
            'date_ouverture' => $validated['date_ouverture'] ?? now()->toDateString(),
            'cree_par_id' => $utilisateur->id,
        ]);

        return response()->json($this->formaterDossier($dossier->fresh(['beneficiaire', 'responsableSecteur', 'objectifs'])), 201);
    }

    /**
     * Modifie les informations du dossier — titre, bénéficiaire, et le
     * responsable de secteur (réaffectation : absence, changement
     * d'affectation...). La catégorie/date d'ouverture ne changent jamais
     * après coup.
     */
    public function updateDossier(Request $request, int $id)
    {
        $utilisateur = auth('api')->user();
        $dossier = PaiDossier::findOrFail($id);

        if (!$this->aSupervisionTransverse($utilisateur) && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }

        $validated = $request->validate([
            'titre' => ['required', 'string', 'max:255', Rule::unique('pai_dossiers', 'titre')->ignore($dossier->id)],
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'nom_beneficiaire' => 'nullable|string|max:255',
            'responsable_secteur_id' => 'required|integer|exists:utilisateurs,id',
            'description' => 'nullable|string',
        ], [
            'titre.unique' => 'Un dossier PAI porte déjà ce titre — choisissez-en un autre.',
        ]);

        if (empty($validated['personnel_concerne_id']) && empty($validated['nom_beneficiaire'])) {
            return response()->json(['error' => 'Indiquez le bénéficiaire concerné (nom, ou compte existant).'], 422);
        }

        $dossier->update([
            'titre' => $validated['titre'],
            'personnel_concerne_id' => $validated['personnel_concerne_id'] ?? null,
            'nom_beneficiaire' => empty($validated['personnel_concerne_id']) ? ($validated['nom_beneficiaire'] ?? null) : null,
            'responsable_secteur_id' => $validated['responsable_secteur_id'],
            'description' => $validated['description'] ?? null,
        ]);

        return response()->json($this->formaterDossier($dossier->fresh(['beneficiaire', 'responsableSecteur', 'objectifs'])), 200);
    }

    /**
     * Clôture manuelle (ex: fin de l'accompagnement) — la seule façon dont un
     * PAI se ferme, jamais automatiquement.
     */
    public function cloturer(int $id)
    {
        $utilisateur = auth('api')->user();
        $dossier = PaiDossier::findOrFail($id);

        if (!$this->aSupervisionTransverse($utilisateur) && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }

        $dossier->update(['date_cloture' => now()->toDateString()]);
        return response()->json($this->formaterDossier($dossier->fresh(['beneficiaire', 'responsableSecteur', 'objectifs'])), 200);
    }

    public function reouvrir(int $id)
    {
        $utilisateur = auth('api')->user();
        $dossier = PaiDossier::findOrFail($id);

        if (!$this->aSupervisionTransverse($utilisateur) && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }

        $dossier->update(['date_cloture' => null]);
        return response()->json($this->formaterDossier($dossier->fresh(['beneficiaire', 'responsableSecteur', 'objectifs'])), 200);
    }

    /**
     * Crée le dossier ET son protocole en une seule fois, à partir du
     * formulaire de rédaction (voir ProtocolePai.jsx, mode "nouveau") — évite
     * de faire remplir deux formulaires séparés (dossier, puis protocole) pour
     * la même information : titre et bénéficiaire sont déduits directement du
     * protocole rédigé.
     */
    public function storeAvecProtocole(Request $request)
    {
        $utilisateur = auth('api')->user();

        $validated = $request->validate([
            'protocole' => 'required|array',
            'responsable_secteur_id' => 'required|integer|exists:utilisateurs,id',
        ]);

        $beneficiaire = $validated['protocole']['beneficiaire'] ?? [];
        $nomComplet = trim(($beneficiaire['prenom'] ?? '') . ' ' . ($beneficiaire['nom'] ?? ''));
        if ($nomComplet === '') {
            return response()->json(['error' => 'Indiquez au moins le nom du bénéficiaire.'], 422);
        }

        $categorieId = CategorieDocument::where('libelle_cat', self::LIBELLE_CATEGORIE_DEFAUT)->value('id');
        if (!$categorieId) {
            return response()->json(['error' => "Catégorie \"" . self::LIBELLE_CATEGORIE_DEFAUT . "\" introuvable — contactez un administrateur."], 500);
        }

        // Un même bénéficiaire peut avoir plusieurs dossiers au fil du temps
        // (ex: reprise après une clôture) — titre unique (contrainte de
        // PaiDossier), d'où le suffixe numéroté en cas de doublon.
        $titreBase = "PAI — {$nomComplet}";
        $titre = $titreBase;
        $suffixe = 2;
        while (PaiDossier::where('titre', $titre)->exists()) {
            $titre = "{$titreBase} ({$suffixe})";
            $suffixe++;
        }

        $dossier = PaiDossier::create([
            'titre' => $titre,
            'nom_beneficiaire' => $nomComplet,
            'responsable_secteur_id' => $validated['responsable_secteur_id'],
            'categorie_id' => $categorieId,
            'date_ouverture' => now()->toDateString(),
            'cree_par_id' => $utilisateur->id,
            'protocole' => $validated['protocole'],
            'protocole_maj_le' => now(),
            'protocole_maj_par_id' => $utilisateur->id,
        ]);

        return response()->json($this->formaterDossier($dossier->fresh(['beneficiaire', 'responsableSecteur', 'objectifs', 'protocoleMajPar']), true), 201);
    }

    /**
     * Enregistre le protocole de prise en charge rédigé en interne (voir
     * ProtocolePai.jsx) — remplace entièrement le contenu précédent à chaque
     * sauvegarde, pas de fusion : c'est un document structuré unique, pas une
     * liste d'éléments comme les objectifs.
     */
    public function updateProtocole(Request $request, int $id)
    {
        $utilisateur = auth('api')->user();
        $dossier = PaiDossier::findOrFail($id);

        if (!$this->aSupervisionTransverse($utilisateur) && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }

        $validated = $request->validate([
            'protocole' => 'required|array',
        ]);

        $dossier->update([
            'protocole' => $validated['protocole'],
            'protocole_maj_le' => now(),
            'protocole_maj_par_id' => $utilisateur->id,
        ]);

        return response()->json($this->formaterDossier($dossier->fresh(['beneficiaire', 'responsableSecteur', 'objectifs', 'protocoleMajPar']), true), 200);
    }

    public function storeObjectif(Request $request, int $dossierId)
    {
        $utilisateur = auth('api')->user();
        $dossier = PaiDossier::findOrFail($dossierId);

        if (!$this->aSupervisionTransverse($utilisateur) && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }

        $validated = $request->validate([
            'description' => 'required|string|max:255',
            'echeance' => 'required|date',
        ]);

        $objectif = $dossier->objectifs()->create($validated);

        return response()->json($objectif, 201);
    }

    public function updateObjectif(Request $request, int $objectifId)
    {
        $utilisateur = auth('api')->user();
        $objectif = PaiObjectif::with('dossier')->findOrFail($objectifId);
        $dossier = $objectif->dossier;

        if (!$this->aSupervisionTransverse($utilisateur) && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }

        $validated = $request->validate([
            'description' => 'required|string|max:255',
            'echeance' => 'required|date',
        ]);

        $objectif->update($validated);

        // L'échéance a changé : si l'objectif n'est plus en retard (ou l'est à
        // nouveau), on laisse la commande planifiée réévaluer et ré-alerter au
        // besoin plutôt que de garder une alerte (ou un rappel/escalade)
        // correspondant à l'ancienne date.
        $objectif->update(['alerte_envoyee_le' => null, 'rappel_envoye_le' => null, 'escalade_envoyee_le' => null]);

        return response()->json($objectif->fresh('realisePar'), 200);
    }

    public function toggleObjectif(int $objectifId)
    {
        $utilisateur = auth('api')->user();
        $objectif = PaiObjectif::with('dossier')->findOrFail($objectifId);
        $dossier = $objectif->dossier;

        if (!$this->aSupervisionTransverse($utilisateur) && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }

        $nouvelEtat = !$objectif->fait;
        $objectif->update([
            'fait' => $nouvelEtat,
            'date_realisation' => $nouvelEtat ? now()->toDateString() : null,
            'realise_par_id' => $nouvelEtat ? $utilisateur->id : null,
            // Remis à null dans les deux sens : fait -> plus besoin d'alerter ;
            // ré-ouvert -> laisse la commande planifiée réévaluer et ré-alerter
            // (rappel, retard ou escalade) s'il est toujours en retard.
            'alerte_envoyee_le' => null,
            'rappel_envoye_le' => null,
            'escalade_envoyee_le' => null,
        ]);

        return response()->json($objectif->fresh('realisePar'), 200);
    }

    public function destroyObjectif(int $objectifId)
    {
        $utilisateur = auth('api')->user();
        $objectif = PaiObjectif::with('dossier')->findOrFail($objectifId);
        $dossier = $objectif->dossier;

        if (!$this->aSupervisionTransverse($utilisateur) && $dossier->responsable_secteur_id !== $utilisateur->id) {
            return response()->json(['error' => "Vous n'avez pas accès à ce dossier."], 403);
        }

        $objectif->delete();
        return response()->json(['message' => 'Objectif supprimé.'], 200);
    }

    /**
     * Compteurs agrégés pour la tuile du tableau de bord — mêmes règles de
     * visibilité que index() (supervision transverse = tout, sinon seulement
     * ses propres dossiers).
     */
    public function compteurs()
    {
        $utilisateur = auth('api')->user();

        $requete = PaiDossier::whereNull('date_cloture')->with('objectifs');
        if (!$this->aSupervisionTransverse($utilisateur)) {
            $requete->where('responsable_secteur_id', $utilisateur->id);
        }

        $dossiers = $requete->get();
        $enRetard = $dossiers->sum(fn (PaiDossier $d) => $d->objectifs->filter(fn (PaiObjectif $o) => $o->estEnRetard())->count());

        return response()->json([
            'dossiers_actifs' => $dossiers->count(),
            'objectifs_en_retard' => $enRetard,
        ], 200);
    }

    private function formaterDossier(PaiDossier $dossier, bool $detaille = false): array
    {
        $objectifs = $dossier->objectifs;
        $enRetard = $objectifs->filter(fn (PaiObjectif $o) => $o->estEnRetard())->count();

        $data = [
            'id' => $dossier->id,
            'titre' => $dossier->titre,
            'nom_beneficiaire' => $dossier->nomBeneficiaire(),
            'responsable_secteur' => $dossier->responsableSecteur ? [
                'id' => $dossier->responsableSecteur->id,
                'nom' => $dossier->responsableSecteur->nom,
            ] : null,
            'description' => $dossier->description,
            'date_ouverture' => $dossier->date_ouverture?->toDateString(),
            'date_cloture' => $dossier->date_cloture?->toDateString(),
            'nb_objectifs' => $objectifs->count(),
            'nb_objectifs_faits' => $objectifs->where('fait', true)->count(),
            'nb_objectifs_en_retard' => $enRetard,
            'hissap_pai_id' => $dossier->hissap_pai_id,
            'synchronise_le' => $dossier->synchronise_le?->toIso8601String(),
        ];

        if ($detaille) {
            // Visible ici seulement : show() a déjà restreint l'accès au
            // responsable du dossier et à la supervision transverse — les
            // données de santé éventuelles ne sortent jamais dans index().
            $data['hissap'] = $dossier->donnees_hissap;
            $data['protocole'] = $dossier->protocole;
            $data['protocole_maj_le'] = $dossier->protocole_maj_le?->toIso8601String();
            $data['protocole_maj_par'] = $dossier->protocoleMajPar?->nom;
            $data['objectifs'] = $objectifs->sortBy('echeance')->values()->map(fn (PaiObjectif $o) => [
                'id' => $o->id,
                'description' => $o->description,
                'echeance' => $o->echeance->toDateString(),
                'fait' => $o->fait,
                'date_realisation' => $o->date_realisation?->toDateString(),
                'realise_par' => $o->realisePar?->nom,
                'en_retard' => $o->estEnRetard(),
                'issu_de_hissap' => $o->issu_de_hissap,
            ]);
        }

        return $data;
    }
}
