<?php

namespace App\Http\Controllers;

use App\Enums\StatutDocument;
use App\Models\CategorieDocument;
use App\Models\DocumentArchive;
use App\Models\HistoriqueStatut;
use App\Models\SuiviDelai;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class StatistiquesController extends Controller
{
    /**
     * Statuts comptant comme "en attente de validation" pour la carte de synthèse —
     * en miroir de ce que Home.jsx appelle déjà "à traiter" (voir aTraiter()
     * côté DocumentController), sans le statut Incomplet/Rejeté qui attend une
     * action du déposant, pas d'un validateur.
     */
    private const STATUTS_EN_ATTENTE = [
        StatutDocument::SOUMIS->value,
        StatutDocument::TRANSMIS_AU_SERVICE->value,
        StatutDocument::EN_COURS_DE_TRAITEMENT->value,
    ];

    /**
     * Décisions comptant comme "traité" pour les stats personnelles de
     * validation — un changement de statut vers l'un ou l'autre est une
     * vraie décision prise par le validateur, contrairement à un simple
     * "Transmis au service" ou "En cours de traitement" qui ne fait
     * qu'avancer le document sans trancher.
     */
    private const DECISIONS_TRAITEMENT = [
        StatutDocument::VALIDE_ET_TRAITE->value,
        StatutDocument::INCOMPLET_REJETE->value,
    ];

    private const NOMBRE_MOIS_HISTORIQUE = 12;

    private const NOMBRE_CATEGORIES_TOP = 6;

    /**
     * Rôles voyant la vue d'ensemble de toute l'entreprise plutôt que leurs
     * seules statistiques personnelles — le pilotage global reste réservé à
     * l'administrateur et au rôle Viewer ("le boss", lecture seule sur tout),
     * jamais à un Éditeur, même de service, qui ne voit que son périmètre.
     */
    private const ROLES_VUE_GLOBALE = ['Administrator', 'Viewer'];

    /**
     * Vue chiffrée de l'activité documentaire — combine des données déjà
     * journalisées ailleurs (statuts, historique, suivis de délai) plutôt que
     * d'ajouter un nouveau système de mesure. Un compte dépôt (Intervenant,
     * Bénéficiaire) n'a rien à faire ici, même la version personnelle ne le
     * concerne pas (voir Sidebar.jsx, qui ne montre le lien qu'au personnel
     * interne) — d'où le blocage explicite plutôt qu'une simple omission de
     * middleware.
     */
    public function index()
    {
        $utilisateur = auth('api')->user();
        $role = $utilisateur->roles()->pluck('nom')->first();

        if (in_array($role, ['Intervenant', 'Beneficiaire'], true)) {
            abort(403);
        }

        if (in_array($role, self::ROLES_VUE_GLOBALE, true)) {
            return response()->json([
                'portee' => 'globale',
                'totaux' => $this->totaux(DocumentArchive::query()),
                'repartition_statuts' => $this->repartitionStatuts(DocumentArchive::query()),
                'volume_par_mois' => $this->volumeParMois(DocumentArchive::query(), 'created_at'),
                'top_categories' => $this->topCategories(DocumentArchive::query()),
                'temps_moyen_validation_heures' => $this->tempsMoyenValidationHeures(),
                'suivis_delais_niveaux' => $this->suivisDelaisNiveaux(),
                'courriers' => $this->courriers(),
            ]);
        }

        return response()->json([
            'portee' => 'personnelle',
            'mes_depots' => $this->mesDepots($utilisateur->id),
            'mes_validations' => $this->mesValidations($utilisateur->id),
        ]);
    }

    /**
     * Mes documents déposés : mêmes indicateurs que la vue globale
     * (totaux/répartition/volume/catégories/délai de validation), simplement
     * filtrés sur mes propres dépôts plutôt que tout le monde.
     */
    private function mesDepots(int $utilisateurId): array
    {
        $base = DocumentArchive::where('utilisateur_id', $utilisateurId);

        return [
            'totaux' => $this->totaux((clone $base)),
            'repartition_statuts' => $this->repartitionStatuts((clone $base)),
            'volume_par_mois' => $this->volumeParMois((clone $base), 'created_at'),
            'top_categories' => $this->topCategories((clone $base)),
            'temps_moyen_validation_heures' => $this->tempsMoyenValidationHeures($utilisateurId),
        ];
    }

    /**
     * Mes décisions de validation : combien de fois j'ai fait passer un
     * document à Validé/Traité ou Incomplet/Rejeté — distinct de "mes
     * dépôts", ça mesure le travail de traitement plutôt que de dépôt (ex: un
     * Éditeur qui valide les dossiers déposés par d'autres).
     */
    private function mesValidations(int $utilisateurId): array
    {
        $base = HistoriqueStatut::where('utilisateur_id', $utilisateurId)
            ->whereIn('nouveau_statut', self::DECISIONS_TRAITEMENT);

        $totaux = [
            'total_traites' => (clone $base)->count(),
            'traites_ce_mois' => (clone $base)->where('date_changement', '>=', now()->startOfMonth())->count(),
        ];

        $repartitionDecisions = (clone $base)
            ->select('nouveau_statut', DB::raw('count(*) as total'))
            ->groupBy('nouveau_statut')
            ->pluck('total', 'nouveau_statut');

        $decisions = [];
        foreach (self::DECISIONS_TRAITEMENT as $statut) {
            $decisions[$statut] = (int) ($repartitionDecisions[$statut] ?? 0);
        }

        return [
            'totaux' => $totaux,
            'repartition_decisions' => $decisions,
            'volume_par_mois' => $this->volumeParMois((clone $base), 'date_changement'),
        ];
    }

    private function totaux(Builder $base): array
    {
        return [
            'documents' => (clone $base)->count(),
            'documents_ce_mois' => (clone $base)->where('created_at', '>=', now()->startOfMonth())->count(),
            'en_attente_validation' => (clone $base)->whereIn('status_doc', self::STATUTS_EN_ATTENTE)->count(),
        ];
    }

    /**
     * @return array<string, int>
     */
    private function repartitionStatuts(Builder $base): array
    {
        $comptes = (clone $base)->select('status_doc', DB::raw('count(*) as total'))
            ->groupBy('status_doc')
            ->pluck('total', 'status_doc');

        // Toujours les 7 statuts, même à 0 — pour que le donut garde une
        // légende stable d'un mois sur l'autre plutôt que de faire apparaître/
        // disparaître des tranches selon l'activité récente.
        $repartition = [];
        foreach (StatutDocument::cases() as $statut) {
            $repartition[$statut->value] = (int) ($comptes[$statut->value] ?? 0);
        }

        return $repartition;
    }

    /**
     * Volume par mois sur les 12 derniers mois glissants, mois sans activité
     * inclus à 0 (pas de trou silencieux dans la courbe) — la colonne de date
     * varie selon l'appelant (created_at pour des dépôts, date_changement
     * pour des décisions de validation).
     *
     * @return array<int, array{mois: string, total: int}>
     */
    private function volumeParMois(Builder $base, string $colonneDate): array
    {
        $debut = now()->startOfMonth()->subMonths(self::NOMBRE_MOIS_HISTORIQUE - 1);

        $comptesParMois = (clone $base)->select(
            DB::raw("DATE_FORMAT({$colonneDate}, '%Y-%m') as mois"),
            DB::raw('count(*) as total')
        )
            ->where($colonneDate, '>=', $debut)
            ->groupBy('mois')
            ->pluck('total', 'mois');

        $serie = [];
        for ($i = self::NOMBRE_MOIS_HISTORIQUE - 1; $i >= 0; $i--) {
            $cle = now()->startOfMonth()->subMonths($i)->format('Y-m');
            $serie[] = [
                'mois' => $cle,
                'total' => (int) ($comptesParMois[$cle] ?? 0),
            ];
        }

        return $serie;
    }

    /**
     * @return array<int, array{id: int, libelle_cat: string, libelle_cat_en: ?string, total: int}>
     */
    private function topCategories(Builder $base): array
    {
        return (clone $base)->select('categorie_id', DB::raw('count(*) as total'))
            ->whereNotNull('categorie_id')
            ->groupBy('categorie_id')
            ->orderByDesc('total')
            ->limit(self::NOMBRE_CATEGORIES_TOP)
            ->get()
            ->map(function ($ligne) {
                $categorie = CategorieDocument::find($ligne->categorie_id);

                // Champs nommés comme sur le modèle CategorieDocument (libelle_cat/
                // libelle_cat_en) — le frontend réutilise nomCategorie() tel quel,
                // sans avoir à traduire un format différent pour cet écran.
                return [
                    'id' => $ligne->categorie_id,
                    'libelle_cat' => $categorie->libelle_cat ?? '—',
                    'libelle_cat_en' => $categorie->libelle_cat_en ?? null,
                    'total' => (int) $ligne->total,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Délai moyen (en heures) entre le dépôt d'un document et son passage à
     * "Validé et traité", sur les 3 derniers mois — un indicateur plus ancien
     * n'aurait plus grand sens vu l'évolution des équipes/volumes. Filtré sur
     * le déposant quand fourni (vue personnelle), sur tout le monde sinon.
     */
    private function tempsMoyenValidationHeures(?int $utilisateurId = null): ?float
    {
        $depuis = now()->subMonths(3);

        $requete = HistoriqueStatut::join('document_archives', 'document_archives.id', '=', 'historique_statuts.document_archive_id')
            ->where('historique_statuts.nouveau_statut', StatutDocument::VALIDE_ET_TRAITE->value)
            ->where('historique_statuts.date_changement', '>=', $depuis)
            ->whereNull('document_archives.deleted_at');

        if ($utilisateurId !== null) {
            $requete->where('document_archives.utilisateur_id', $utilisateurId);
        }

        $moyenneSecondes = $requete
            ->select(DB::raw('AVG(TIMESTAMPDIFF(SECOND, document_archives.created_at, historique_statuts.date_changement)) as moyenne'))
            ->value('moyenne');

        return $moyenneSecondes !== null ? round($moyenneSecondes / 3600, 1) : null;
    }

    /**
     * Répartition des suivis de délai actifs par niveau d'alerte — le niveau
     * stocké en base (mis à jour par delais:verifier), pas recalculé à la
     * volée, pour rester cohérent avec ce que voit chaque fiche document.
     * Uniquement dans la vue globale : c'est un indicateur de pilotage
     * d'entreprise, pas une statistique personnelle.
     *
     * @return array<string, int>
     */
    private function suivisDelaisNiveaux(): array
    {
        $comptes = SuiviDelai::whereNull('termine_le')
            ->select('niveau_alerte', DB::raw('count(*) as total'))
            ->groupBy('niveau_alerte')
            ->pluck('total', 'niveau_alerte');

        return [
            'VERT' => (int) ($comptes['VERT'] ?? 0),
            'ORANGE' => (int) ($comptes['ORANGE'] ?? 0),
            'ROUGE' => (int) ($comptes['ROUGE'] ?? 0),
        ];
    }

    /**
     * Volumes entrants/sortants et répartition par état des courriers entrants
     * (voir CourrierForm.jsx) — uniquement dans la vue globale, comme
     * suivisDelaisNiveaux(), c'est un indicateur de pilotage du dossier
     * ADMIN_DOC, pas une statistique personnelle.
     */
    private function courriers(): array
    {
        $entrants = DocumentArchive::where('sens_courrier', 'entrant');
        $sortants = DocumentArchive::where('sens_courrier', 'sortant');

        $comptesEtat = (clone $entrants)
            ->whereNotNull('etat_courrier')
            ->select('etat_courrier', DB::raw('count(*) as total'))
            ->groupBy('etat_courrier')
            ->pluck('total', 'etat_courrier');

        return [
            'total_entrants' => (clone $entrants)->count(),
            'total_sortants' => (clone $sortants)->count(),
            'entrants_ce_mois' => (clone $entrants)->where('created_at', '>=', now()->startOfMonth())->count(),
            'sortants_ce_mois' => (clone $sortants)->where('created_at', '>=', now()->startOfMonth())->count(),
            // Mêmes 7 valeurs que le formulaire (voir CourrierForm.jsx), toujours
            // présentes même à 0 pour une légende stable.
            'repartition_etat' => [
                'Prélèvement' => (int) ($comptesEtat['Prélèvement'] ?? 0),
                'En attente' => (int) ($comptesEtat['En attente'] ?? 0),
                'Payé' => (int) ($comptesEtat['Payé'] ?? 0),
                'Enregistré' => (int) ($comptesEtat['Enregistré'] ?? 0),
                'Déposé' => (int) ($comptesEtat['Déposé'] ?? 0),
                'Traité' => (int) ($comptesEtat['Traité'] ?? 0),
                'N/C' => (int) ($comptesEtat['N/C'] ?? 0),
            ],
        ];
    }
}
