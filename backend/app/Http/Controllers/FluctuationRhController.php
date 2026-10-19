<?php

namespace App\Http\Controllers;

use App\Models\FluctuationRh;
use App\Models\FluctuationRhMois;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Fluctuation RH — éléments variables de paie du mois (voir FluctuationRh).
 * Toutes les routes, lecture comprise, sont réservées à gerer_fluctuation_rh
 * (RH + Comptabilité/Paie, voir RoleSeeder) : contrairement aux chèques ou
 * aux PAI, ce tableau contient des données de santé (arrêts maladie,
 * accidents du travail, mi-temps thérapeutique) et de rémunération.
 */
class FluctuationRhController extends Controller
{
    private const REGLES_LIGNE = [
        'salarie' => 'required|string|max:255',
        'date_debut' => 'nullable|date',
        'date_fin' => 'nullable|date',
        'motif' => 'nullable|string|max:255',
        'heures' => 'nullable|string|max:50',
        'montant' => 'nullable|numeric|min:0|max:99999999',
        'observations' => 'nullable|string|max:2000',
    ];

    /** Lignes d'un mois + son statut (brouillon/validé/transmis). */
    public function index(Request $request)
    {
        $request->validate(['mois' => 'required|date_format:Y-m']);
        $mois = $this->premierDuMois($request->query('mois'));

        $lignes = FluctuationRh::where('mois', $mois)
            ->orderBy('section')
            ->orderBy('id')
            ->get();

        return response()->json([
            'mois' => $mois,
            'statut' => $this->statutDuMois($mois),
            'lignes' => $lignes,
        ], 200);
    }

    /**
     * Tous les mois qui ont au moins une ligne ou un statut, avec leur
     * nombre de lignes par section — sert au sélecteur de mois et à la vue
     * d'ensemble de l'année.
     */
    public function mois()
    {
        $comptes = FluctuationRh::select('mois', 'section', DB::raw('count(*) as total'))
            ->groupBy('mois', 'section')
            ->get();
        $statuts = FluctuationRhMois::all()->keyBy(fn ($m) => $m->mois->format('Y-m-d'));

        $parMois = [];
        foreach ($comptes as $c) {
            $cle = Carbon::parse($c->mois)->format('Y-m-d');
            $parMois[$cle]['sections'][$c->section] = (int) $c->total;
        }
        foreach ($statuts as $cle => $s) {
            $parMois[$cle] = $parMois[$cle] ?? ['sections' => []];
        }

        $resultat = [];
        foreach ($parMois as $cle => $infos) {
            $resultat[] = [
                'mois' => $cle,
                'statut' => $statuts[$cle]->statut ?? FluctuationRhMois::BROUILLON,
                'sections' => (object) ($infos['sections'] ?? []),
                'total' => array_sum($infos['sections'] ?? []),
            ];
        }
        usort($resultat, fn ($a, $b) => strcmp($b['mois'], $a['mois']));

        return response()->json($resultat, 200);
    }

    /** Noms déjà saisis, pour l'autocomplétion du champ salarié. */
    public function salaries()
    {
        $noms = FluctuationRh::select('salarie')->distinct()->orderBy('salarie')->pluck('salarie');
        return response()->json($noms, 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'mois' => 'required|date_format:Y-m',
            'section' => ['required', Rule::in(FluctuationRh::SECTIONS)],
            ...self::REGLES_LIGNE,
        ]);
        $validated['mois'] = $this->premierDuMois($validated['mois']);

        if ($erreur = $this->refusSiVerrouille($validated['mois'])) {
            return $erreur;
        }

        $validated['salarie'] = trim($validated['salarie']);
        $validated['utilisateur_id'] = auth('api')->id();
        $ligne = FluctuationRh::create($validated);

        return response()->json($ligne, 201);
    }

    public function update(Request $request, FluctuationRh $fluctuation)
    {
        $validated = $request->validate([
            'section' => ['required', Rule::in(FluctuationRh::SECTIONS)],
            ...self::REGLES_LIGNE,
        ]);

        if ($erreur = $this->refusSiVerrouille($fluctuation->mois->format('Y-m-d'))) {
            return $erreur;
        }

        $validated['salarie'] = trim($validated['salarie']);
        $validated['modifie_par_id'] = auth('api')->id();
        $fluctuation->update($validated);

        return response()->json($fluctuation, 200);
    }

    public function destroy(FluctuationRh $fluctuation)
    {
        if ($erreur = $this->refusSiVerrouille($fluctuation->mois->format('Y-m-d'))) {
            return $erreur;
        }

        $fluctuation->delete();
        return response()->json(['message' => 'Ligne supprimée'], 200);
    }

    /**
     * Import du classeur Google Sheets (un onglet par mois), déjà découpé en
     * lignes côté navigateur (voir frontend/src/utils/importFluctuationRh.js).
     * remplacer=true efface d'abord les lignes existantes des mois importés —
     * sinon un deuxième import du même classeur doublerait tout. Les mois
     * validés/transmis sont ignorés (jamais écrasés) et renvoyés à part.
     */
    public function importer(Request $request)
    {
        $request->validate([
            'remplacer' => 'boolean',
            'mois' => 'required|array|min:1|max:60',
            'mois.*.mois' => 'required|date_format:Y-m',
            'mois.*.lignes' => 'present|array|max:500',
            'mois.*.lignes.*.section' => ['required', Rule::in(FluctuationRh::SECTIONS)],
            ...collect(self::REGLES_LIGNE)->mapWithKeys(fn ($regle, $champ) => ["mois.*.lignes.*.$champ" => $regle])->all(),
        ]);

        $remplacer = $request->boolean('remplacer');
        $utilisateurId = auth('api')->id();
        $importes = [];
        $ignores = [];

        DB::transaction(function () use ($request, $remplacer, $utilisateurId, &$importes, &$ignores) {
            foreach ($request->input('mois') as $blocMois) {
                $mois = $this->premierDuMois($blocMois['mois']);
                if (FluctuationRhMois::estVerrouille($mois)) {
                    $ignores[] = $mois;
                    continue;
                }
                if ($remplacer) {
                    FluctuationRh::where('mois', $mois)->delete();
                }
                foreach ($blocMois['lignes'] as $ligne) {
                    FluctuationRh::create([
                        'mois' => $mois,
                        'section' => $ligne['section'],
                        'salarie' => trim($ligne['salarie']),
                        'date_debut' => $ligne['date_debut'] ?? null,
                        'date_fin' => $ligne['date_fin'] ?? null,
                        'motif' => $ligne['motif'] ?? null,
                        'heures' => $ligne['heures'] ?? null,
                        'montant' => $ligne['montant'] ?? null,
                        'observations' => $ligne['observations'] ?? null,
                        'utilisateur_id' => $utilisateurId,
                    ]);
                }
                $importes[] = ['mois' => $mois, 'lignes' => count($blocMois['lignes'])];
            }
        });

        return response()->json(['importes' => $importes, 'ignores' => $ignores], 200);
    }

    /**
     * valider (RH) -> transmettre (paie) ; rouvrir ramène en brouillon pour
     * corriger un oubli. Chaque étape garde qui/quand, effacé à la réouverture.
     */
    public function changerStatut(Request $request, string $mois)
    {
        $request->validate(['action' => 'required|in:valider,transmettre,rouvrir']);
        if (!preg_match('/^\d{4}-\d{2}$/', $mois)) {
            return response()->json(['error' => 'Mois invalide.'], 422);
        }
        $date = $this->premierDuMois($mois);
        $enregistrement = FluctuationRhMois::firstOrCreate(['mois' => $date], ['statut' => FluctuationRhMois::BROUILLON]);
        $userId = auth('api')->id();

        switch ($request->input('action')) {
            case 'valider':
                if ($enregistrement->statut !== FluctuationRhMois::BROUILLON) {
                    return response()->json(['error' => 'Ce mois est déjà validé.'], 422);
                }
                $enregistrement->update(['statut' => FluctuationRhMois::VALIDE, 'valide_le' => now(), 'valide_par_id' => $userId]);
                break;
            case 'transmettre':
                if ($enregistrement->statut !== FluctuationRhMois::VALIDE) {
                    return response()->json(['error' => 'Le mois doit d\'abord être validé avant d\'être transmis à la paie.'], 422);
                }
                $enregistrement->update(['statut' => FluctuationRhMois::TRANSMIS, 'transmis_le' => now(), 'transmis_par_id' => $userId]);
                break;
            case 'rouvrir':
                $enregistrement->update([
                    'statut' => FluctuationRhMois::BROUILLON,
                    'valide_le' => null, 'valide_par_id' => null,
                    'transmis_le' => null, 'transmis_par_id' => null,
                ]);
                break;
        }

        return response()->json($this->statutDuMois($date), 200);
    }

    private function premierDuMois(string $mois): string
    {
        return Carbon::createFromFormat('Y-m', $mois)->startOfMonth()->format('Y-m-d');
    }

    private function statutDuMois(string $mois): array
    {
        // Juste de quoi afficher "validé par Prénom NOM" : jamais le profil
        // complet (téléphone, e-mail...) de la personne.
        $nomSeulement = [
            'validePar:id,nom', 'validePar.personnels:id,utilisateur_id,nom,prenom',
            'transmisPar:id,nom', 'transmisPar.personnels:id,utilisateur_id,nom,prenom',
        ];
        $enregistrement = FluctuationRhMois::with($nomSeulement)->where('mois', $mois)->first();
        if (!$enregistrement) {
            return ['statut' => FluctuationRhMois::BROUILLON];
        }

        return [
            'statut' => $enregistrement->statut,
            'valide_le' => $enregistrement->valide_le,
            'valide_par' => $enregistrement->validePar,
            'transmis_le' => $enregistrement->transmis_le,
            'transmis_par' => $enregistrement->transmisPar,
        ];
    }

    private function refusSiVerrouille(string $mois)
    {
        if (FluctuationRhMois::estVerrouille($mois)) {
            return response()->json(['error' => 'Ce mois est validé : rouvrez-le avant de le modifier.'], 423);
        }
        return null;
    }
}
