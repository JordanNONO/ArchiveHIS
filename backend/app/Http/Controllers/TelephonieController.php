<?php

namespace App\Http\Controllers;

use App\Models\Personnels;
use App\Models\TelephonieAppareil;
use App\Models\TelephonieDetention;
use App\Models\TelephonieIncident;
use App\Models\TelephonieLigne;
use App\Models\TelephonieRemise;
use App\Services\TelephonieAlertes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * Parc des téléphones et des lignes SIM confiés aux salariés.
 *
 * Deux inventaires indépendants reliés par des détentions, et des remises qui
 * portent la décharge — voir les migrations telephonie_* pour le pourquoi de
 * cette séparation (un téléphone qui casse ne doit pas interrompre la
 * détention du numéro).
 *
 * index() renvoie tout le parc en une requête, comme le registre des
 * courriers : la page a quatre onglets qui lisent les mêmes données, les
 * découper en quatre appels ferait quatre allers-retours pour rien.
 */
class TelephonieController extends Controller
{
    public function __construct(private TelephonieAlertes $alertes)
    {
    }

    public function index()
    {
        $appareils = TelephonieAppareil::with([
            'detentionEnCours.personnel:id,nom,prenom',
        ])->orderBy('modele')->get();

        $lignes = TelephonieLigne::with([
            'detentionEnCours.personnel:id,nom,prenom',
        ])->orderBy('numero')->get();

        $detentions = TelephonieDetention::enCours()
            ->with(['personnel:id,nom,prenom', 'appareil:id,modele,imei,etat', 'ligne:id,numero,operateur,forfait,cout_mensuel', 'remise'])
            ->orderByDesc('date_debut')
            ->get();

        $incidents = TelephonieIncident::with([
            'personnel:id,nom,prenom',
            'appareil:id,modele,imei',
            'ligne:id,numero',
            'justificatif:id,titre_document',
        ])->orderByDesc('date_incident')->orderByDesc('id')->get();

        return response()->json([
            'appareils' => $appareils,
            'lignes' => $lignes,
            'detentions' => $detentions,
            'incidents' => $incidents,
            'alertes' => $this->alertes->toutes(),
            'resume' => $this->resume($appareils, $lignes, $detentions, $incidents),
        ], 200);
    }

    /** Les compteurs des tuiles de la vue d'ensemble. */
    private function resume($appareils, $lignes, $detentions, $incidents): array
    {
        $anneeEnCours = $incidents->filter(fn ($i) => $i->date_incident?->year === now()->year);

        return [
            'appareils_total' => $appareils->count(),
            'appareils_attribues' => $detentions->whereNotNull('appareil_id')->count(),
            'appareils_en_stock' => $appareils->where('etat', 'en_stock')->count(),
            'appareils_hors_service' => $appareils->whereIn('etat', TelephonieAppareil::ETATS_INDISPONIBLES)->count(),
            'lignes_total' => $lignes->count(),
            'lignes_attribuees' => $detentions->whereNotNull('ligne_id')->count(),
            'lignes_suspendues' => $lignes->where('statut', 'suspendue')->count(),
            // Seules les lignes actives sont facturées : inclure les résiliées
            // gonflerait un coût qu'on ne paie plus.
            'cout_mensuel' => round($lignes->where('statut', 'active')->sum(fn ($l) => (float) $l->cout_mensuel), 2),
            'incidents_annee' => $anneeEnCours->count(),
            'incidents_montant_annee' => round($anneeEnCours->sum(fn ($i) => (float) $i->montant), 2),
            'incidents_sans_suite' => $incidents->where('suite_donnee', 'a_decider')->count(),
            'fiches_a_completer' => $appareils->where('fiche_a_completer', true)->count()
                + $lignes->where('fiche_a_completer', true)->count(),
        ];
    }

    // ---------------------------------------------------------------- Appareils

    public function storeAppareil(Request $request)
    {
        $valide = $request->validate($this->reglesAppareil());

        $appareil = new TelephonieAppareil($valide);
        $appareil->cree_par_id = auth('api')->id();
        $appareil->rafraichirFicheACompleter();
        $appareil->save();

        return response()->json($appareil, 201);
    }

    public function updateAppareil(Request $request, TelephonieAppareil $appareil)
    {
        $appareil->fill($request->validate($this->reglesAppareil($appareil->id)));
        $appareil->rafraichirFicheACompleter();
        $appareil->save();

        return response()->json($appareil->fresh(), 200);
    }

    private function reglesAppareil(?int $saufId = null): array
    {
        return [
            'modele' => 'required|string|max:255',
            // L'IMEI reste facultatif : au démarrage les téléphones sont déjà
            // sur le terrain (voir la migration). Unique seulement s'il est là.
            'imei' => ['nullable', 'string', 'max:20', Rule::unique('telephonie_appareils', 'imei')->ignore($saufId)->whereNull('deleted_at')],
            'numero_serie' => 'nullable|string|max:60',
            'date_achat' => 'nullable|date',
            'prix_achat' => 'nullable|numeric|min:0',
            'etat' => ['required', Rule::in(TelephonieAppareil::ETATS)],
            'observations' => 'nullable|string',
        ];
    }

    public function destroyAppareil(TelephonieAppareil $appareil)
    {
        if ($appareil->detentionEnCours) {
            return response()->json(['error' => "Cet appareil est détenu par {$appareil->detentionEnCours->nomSalarie()} — enregistrez sa restitution avant de le retirer."], 409);
        }
        $appareil->delete();

        return response()->json(['message' => 'Appareil retiré du parc.'], 200);
    }

    // ------------------------------------------------------------------ Lignes

    public function storeLigne(Request $request)
    {
        $valide = $request->validate($this->reglesLigne());

        $ligne = new TelephonieLigne($valide);
        $ligne->cree_par_id = auth('api')->id();
        $ligne->fiche_a_completer = empty($valide['forfait']) || !isset($valide['cout_mensuel']);
        $ligne->save();

        return response()->json($ligne, 201);
    }

    public function updateLigne(Request $request, TelephonieLigne $ligne)
    {
        $valide = $request->validate($this->reglesLigne($ligne->id));
        $ligne->fill($valide);
        $ligne->fiche_a_completer = empty($ligne->forfait) || $ligne->cout_mensuel === null;
        $ligne->save();

        return response()->json($ligne->fresh(), 200);
    }

    private function reglesLigne(?int $saufId = null): array
    {
        return [
            'numero' => ['required', 'string', 'max:25', Rule::unique('telephonie_lignes', 'numero')->ignore($saufId)->whereNull('deleted_at')],
            'operateur' => 'required|string|max:40',
            'forfait' => 'nullable|string|max:80',
            'cout_mensuel' => 'nullable|numeric|min:0',
            'iccid' => 'nullable|string|max:25',
            // Facultatifs, demande explicite : tout le monde n'a pas ces codes
            // sous la main au moment de créer la fiche.
            'code_pin' => 'nullable|string|max:12',
            'code_puk' => 'nullable|string|max:20',
            'date_souscription' => 'nullable|date',
            'engagement_jusquau' => 'nullable|date',
            'statut' => ['required', Rule::in(TelephonieLigne::STATUTS)],
            'observations' => 'nullable|string',
        ];
    }

    public function destroyLigne(TelephonieLigne $ligne)
    {
        if ($ligne->detentionEnCours) {
            return response()->json(['error' => "Cette ligne est détenue par {$ligne->detentionEnCours->nomSalarie()} — enregistrez sa restitution avant de la retirer."], 409);
        }
        $ligne->delete();

        return response()->json(['message' => 'Ligne retirée du parc.'], 200);
    }

    /**
     * Lecture des codes PIN/PUK — jamais dans la liste, et chaque accès est
     * journalisé. Un code d'accès qui s'affiche sans laisser de trace n'est
     * plus un code d'accès.
     */
    public function codesLigne(TelephonieLigne $ligne)
    {
        Log::info('Consultation des codes SIM', [
            'ligne_id' => $ligne->id,
            'numero' => $ligne->numero,
            'par' => auth('api')->id(),
        ]);

        return response()->json([
            'code_pin' => $ligne->code_pin,
            'code_puk' => $ligne->code_puk,
        ], 200);
    }

    // ----------------------------------------------------------------- Remises

    /**
     * Confier un téléphone et/ou une ligne à un salarié. Crée l'événement
     * (la remise, qui portera la décharge) et une détention par objet.
     */
    public function storeRemise(Request $request)
    {
        $valide = $request->validate([
            'personnel_id' => 'required|integer|exists:personnels,id',
            'appareil_id' => 'nullable|integer|exists:telephonie_appareils,id',
            'ligne_id' => 'nullable|integer|exists:telephonie_lignes,id',
            'date_remise' => 'required|date',
            'etat_remise' => ['nullable', Rule::in(TelephonieDetention::ETATS_MATERIEL)],
            'avec_chargeur' => 'boolean',
            'avec_coque' => 'boolean',
            'observations' => 'nullable|string',
            'decharge' => 'boolean',
        ]);

        if (empty($valide['appareil_id']) && empty($valide['ligne_id'])) {
            return response()->json(['error' => 'Choisissez au moins un appareil ou une ligne à remettre.'], 422);
        }

        $occupe = $this->premierObjetDejaDetenu($valide['appareil_id'] ?? null, $valide['ligne_id'] ?? null);
        if ($occupe) {
            return response()->json(['error' => $occupe], 409);
        }

        $personnel = Personnels::findOrFail($valide['personnel_id']);

        $remise = DB::transaction(function () use ($valide, $personnel) {
            $remise = TelephonieRemise::create([
                'personnel_id' => $personnel->id,
                'salarie_nom' => trim("{$personnel->nom} {$personnel->prenom}"),
                'date_remise' => $valide['date_remise'],
                'avec_chargeur' => $valide['avec_chargeur'] ?? false,
                'avec_coque' => $valide['avec_coque'] ?? false,
                'observations' => $valide['observations'] ?? null,
                'decharge_statut' => ($valide['decharge'] ?? true) ? 'a_signer' : 'non_requise',
                'cree_par_id' => auth('api')->id(),
            ]);

            $this->ouvrirDetentions($remise, $personnel, $valide);

            if (!empty($valide['appareil_id'])) {
                TelephonieAppareil::where('id', $valide['appareil_id'])->update(['etat' => 'en_service']);
            }

            return $remise;
        });

        return response()->json($remise->load('detentions'), 201);
    }

    /** Une détention par objet — jamais les deux dans la même ligne. */
    private function ouvrirDetentions(TelephonieRemise $remise, Personnels $personnel, array $valide): void
    {
        $commun = [
            'personnel_id' => $personnel->id,
            'salarie_nom' => trim("{$personnel->nom} {$personnel->prenom}"),
            'remise_id' => $remise->id,
            'date_debut' => $valide['date_remise'],
            'etat_debut' => $valide['etat_remise'] ?? null,
            'cree_par_id' => auth('api')->id(),
        ];

        if (!empty($valide['appareil_id'])) {
            TelephonieDetention::create($commun + ['appareil_id' => $valide['appareil_id']]);
        }
        if (!empty($valide['ligne_id'])) {
            TelephonieDetention::create($commun + ['ligne_id' => $valide['ligne_id']]);
        }
    }

    /** Message d'erreur si l'objet est déjà entre les mains de quelqu'un. */
    private function premierObjetDejaDetenu(?int $appareilId, ?int $ligneId): ?string
    {
        if ($appareilId) {
            $detention = TelephonieDetention::enCours()->where('appareil_id', $appareilId)->first();
            if ($detention) {
                return "Cet appareil est déjà détenu par {$detention->nomSalarie()}. Transférez-le plutôt que de le remettre une seconde fois.";
            }
        }
        if ($ligneId) {
            $detention = TelephonieDetention::enCours()->where('ligne_id', $ligneId)->first();
            if ($detention) {
                return "Cette ligne est déjà détenue par {$detention->nomSalarie()}. Transférez-la plutôt que de la remettre une seconde fois.";
            }
        }

        return null;
    }

    // -------------------------------------------------------------- Détentions

    /**
     * Clôturer une détention : restitution, transfert, incident ou fin de
     * contrat. Un transfert enchaîne sur une nouvelle détention — c'est ce qui
     * permet de reprendre une ligne à quelqu'un pour la donner à un autre
     * sans que le matériel repasse par le stock.
     */
    public function cloturerDetention(Request $request, TelephonieDetention $detention)
    {
        if (!$detention->estEnCours()) {
            return response()->json(['error' => 'Cette détention est déjà close.'], 409);
        }

        $valide = $request->validate([
            'date_fin' => 'required|date',
            'motif_fin' => ['required', Rule::in(TelephonieDetention::MOTIFS_FIN)],
            'etat_fin' => ['nullable', Rule::in(TelephonieDetention::ETATS_MATERIEL)],
            'observations' => 'nullable|string',
            // Transfert : à qui.
            'vers_personnel_id' => 'nullable|integer|exists:personnels,id',
        ]);

        if ($valide['motif_fin'] === 'transfert' && empty($valide['vers_personnel_id'])) {
            return response()->json(['error' => 'Un transfert demande de préciser à qui.'], 422);
        }

        DB::transaction(function () use ($detention, $valide) {
            $detention->update([
                'date_fin' => $valide['date_fin'],
                'motif_fin' => $valide['motif_fin'],
                'etat_fin' => $valide['etat_fin'] ?? null,
                'observations' => $valide['observations'] ?? $detention->observations,
            ]);

            if ($valide['motif_fin'] === 'transfert') {
                $vers = Personnels::findOrFail($valide['vers_personnel_id']);
                TelephonieDetention::create([
                    'personnel_id' => $vers->id,
                    'salarie_nom' => trim("{$vers->nom} {$vers->prenom}"),
                    'appareil_id' => $detention->appareil_id,
                    'ligne_id' => $detention->ligne_id,
                    'date_debut' => $valide['date_fin'],
                    'etat_debut' => $valide['etat_fin'] ?? null,
                    'cree_par_id' => auth('api')->id(),
                ]);

                return;
            }

            // Restitution ou fin de contrat : l'appareil revient au stock, sauf
            // s'il est cassé — auquel cas il est hors service, pas disponible.
            if ($detention->appareil_id) {
                $etat = ($valide['etat_fin'] ?? null) === 'casse' ? 'hors_service' : 'en_stock';
                TelephonieAppareil::where('id', $detention->appareil_id)->update(['etat' => $etat]);
            }
        });

        return response()->json($detention->fresh(['appareil', 'ligne', 'personnel']), 200);
    }

    // ----------------------------------------------------------------- Reprise

    /**
     * Reprise de l'existant : enregistrer d'un coup qui détient déjà quoi,
     * sans IMEI ni date d'achat. Si démarrer exigeait dix-huit IMEI relevés
     * au dos d'appareils déjà dispersés sur le terrain, personne ne
     * démarrerait et le module resterait vide.
     *
     * Aucune décharge n'est créée : ces téléphones sont déjà entre les mains
     * des salariés, en réclamer une rétroactivement ferait abandonner la
     * reprise avant la troisième ligne.
     */
    public function storeReprise(Request $request)
    {
        $valide = $request->validate([
            'personnel_id' => 'required|integer|exists:personnels,id',
            'modele' => 'nullable|string|max:255',
            'numero' => 'nullable|string|max:25',
            'operateur' => 'nullable|string|max:40',
            'date_debut' => 'nullable|date',
        ]);

        if (empty($valide['modele']) && empty($valide['numero'])) {
            return response()->json(['error' => 'Indiquez au moins un modèle de téléphone ou un numéro de ligne.'], 422);
        }
        if (!empty($valide['numero']) && empty($valide['operateur'])) {
            return response()->json(['error' => "Précisez l'opérateur de la ligne {$valide['numero']}."], 422);
        }

        $personnel = Personnels::findOrFail($valide['personnel_id']);
        $depuis = $valide['date_debut'] ?? now()->toDateString();

        $resultat = DB::transaction(function () use ($valide, $personnel, $depuis) {
            $commun = [
                'personnel_id' => $personnel->id,
                'salarie_nom' => trim("{$personnel->nom} {$personnel->prenom}"),
                'date_debut' => $depuis,
                'cree_par_id' => auth('api')->id(),
            ];
            $cree = [];

            if (!empty($valide['modele'])) {
                $appareil = TelephonieAppareil::create([
                    'modele' => $valide['modele'],
                    'etat' => 'en_service',
                    'fiche_a_completer' => true,
                    'cree_par_id' => auth('api')->id(),
                ]);
                TelephonieDetention::create($commun + ['appareil_id' => $appareil->id]);
                $cree['appareil'] = $appareil;
            }

            if (!empty($valide['numero'])) {
                // firstOrCreate : le numéro peut déjà exister si quelqu'un a
                // créé la ligne à la main avant de lancer la reprise.
                $ligne = TelephonieLigne::firstOrCreate(
                    ['numero' => $valide['numero']],
                    [
                        'operateur' => $valide['operateur'],
                        'statut' => 'active',
                        'fiche_a_completer' => true,
                        'cree_par_id' => auth('api')->id(),
                    ]
                );
                if (!TelephonieDetention::enCours()->where('ligne_id', $ligne->id)->exists()) {
                    TelephonieDetention::create($commun + ['ligne_id' => $ligne->id]);
                }
                $cree['ligne'] = $ligne;
            }

            return $cree;
        });

        return response()->json($resultat, 201);
    }

    /**
     * Les salariés qui n'ont encore rien d'enregistré — la liste que l'écran
     * de reprise déroule, et la barre d'avancement qui va avec.
     */
    public function salariesSansTelephone()
    {
        $avecDetention = TelephonieDetention::enCours()->whereNotNull('personnel_id')->pluck('personnel_id')->unique();

        $tous = Personnels::orderBy('nom')->orderBy('prenom')->get(['id', 'nom', 'prenom']);

        return response()->json([
            'restants' => $tous->whereNotIn('id', $avecDetention)->values(),
            'enregistres' => $avecDetention->count(),
            'total' => $tous->count(),
        ], 200);
    }

    // --------------------------------------------------------------- Incidents

    public function storeIncident(Request $request)
    {
        $valide = $request->validate($this->reglesIncident());

        $incident = new TelephonieIncident($valide);
        $incident->cree_par_id = auth('api')->id();
        $incident->save();

        $this->repercuterSurLeParc($incident);

        return response()->json($incident->fresh(['appareil', 'ligne', 'personnel']), 201);
    }

    public function updateIncident(Request $request, TelephonieIncident $incident)
    {
        $incident->fill($request->validate($this->reglesIncident()));
        $incident->save();

        $this->repercuterSurLeParc($incident);

        return response()->json($incident->fresh(['appareil', 'ligne', 'personnel']), 200);
    }

    private function reglesIncident(): array
    {
        return [
            'personnel_id' => 'nullable|integer|exists:personnels,id',
            'salarie_nom' => 'nullable|string|max:255',
            'appareil_id' => 'nullable|integer|exists:telephonie_appareils,id',
            'ligne_id' => 'nullable|integer|exists:telephonie_lignes,id',
            'date_incident' => 'required|date',
            'nature' => ['required', Rule::in(TelephonieIncident::NATURES)],
            'montant' => 'nullable|numeric|min:0',
            'suite_donnee' => ['required', Rule::in(TelephonieIncident::SUITES)],
            'justificatif_document_id' => 'nullable|integer|exists:document_archives,id',
            'observations' => 'nullable|string',
        ];
    }

    /**
     * Un téléphone perdu, volé ou cassé ne doit pas rester "en service" dans
     * l'inventaire, et la détention qui le lie à quelqu'un n'a plus lieu
     * d'être. Sans ça, le parc affirmerait que le salarié détient un appareil
     * qui n'existe plus.
     */
    private function repercuterSurLeParc(TelephonieIncident $incident): void
    {
        $etat = TelephonieIncident::ETAT_APPAREIL_APRES[$incident->nature] ?? null;
        if (!$etat || !$incident->appareil_id) {
            return;
        }

        DB::transaction(function () use ($incident, $etat) {
            TelephonieAppareil::where('id', $incident->appareil_id)->update(['etat' => $etat]);

            TelephonieDetention::enCours()
                ->where('appareil_id', $incident->appareil_id)
                ->update([
                    'date_fin' => $incident->date_incident,
                    'motif_fin' => 'incident',
                    'etat_fin' => 'casse',
                ]);
        });
    }

    public function destroyIncident(TelephonieIncident $incident)
    {
        $incident->delete();

        return response()->json(['message' => 'Incident supprimé.'], 200);
    }
}
