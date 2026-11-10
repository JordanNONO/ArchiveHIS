<?php

namespace App\Console\Commands;

use App\Models\CourrierCompteur;
use App\Models\DocumentArchive;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;

/**
 * Répare les références de courrier (CRE-/CRS-AAMMNN) dans deux cas, selon
 * l'option --doublons :
 *
 *  - par défaut, les références DÉCALÉES : la date a été corrigée après
 *    l'enregistrement et la référence porte encore l'ancien mois — ex : un
 *    sortant du 05/11 resté en CRS-261012. Depuis que
 *    DocumentController::update() recalcule la référence, ça ne se produit
 *    plus ; cette commande rattrape l'existant.
 *
 *  - avec --doublons, les références PARTAGÉES par plusieurs courriers,
 *    héritées de l'ancien calcul par count()+1 (remplacé le 27/10/2026 par le
 *    compteur atomique, voir CourrierCompteur::genererReference()). Le
 *    premier saisi de chaque groupe garde sa référence — règle du registre,
 *    premier arrivé premier servi — les autres sont renumérotés. Un courrier
 *    à la corbeille passe après les actifs : c'est lui qu'on renumérote si le
 *    choix se pose, jamais un courrier vivant.
 *
 * Dans les deux cas les nouveaux numéros sont pris via
 * CourrierCompteur::genererReference(), donc à la suite du compteur du bon
 * mois : pas de collision avec les courriers déjà référencés ni avec ceux
 * enregistrés ensuite. Les anciens numéros libérés ne sont pas réutilisés
 * (trous dans la série), comme un numéro barré dans un registre papier.
 *
 * Par défaut : simulation (aucune écriture) — relancer avec --confirmer.
 */
class CorrigerReferencesCourriers extends Command
{
    protected $signature = 'courriers:corriger-references
        {--confirmer : Applique réellement la correction (sans cette option, simulation uniquement)}
        {--doublons : Renumérote les courriers qui partagent leur référence avec un autre, au lieu des références décalées}';

    protected $description = "Renumérote les courriers dont la référence (CRE-/CRS-AAMMNN) ne correspond pas au mois de leur date, ou qui la partagent avec un autre courrier (--doublons)";

    /**
     * Garde-fou : si le numéro suivant est déjà pris, on avance — mais jamais
     * indéfiniment. Une commande dont le travail est de supprimer des
     * doublons ne doit surtout pas en créer un, ni tourner en rond.
     */
    private const TENTATIVES_MAX = 50;

    public function handle(): int
    {
        return $this->option('doublons')
            ? $this->renumeroter($this->doublons(), 'Aucune référence en double : tout est correct.')
            : $this->renumeroter($this->decalees(), 'Aucune référence décalée : tout est correct.');
    }

    /**
     * Les courriers dont la référence ne porte pas le mois de leur date,
     * dans l'ordre chronologique pour que la renumérotation suive le registre.
     */
    private function decalees(): Collection
    {
        return DocumentArchive::whereNotNull('sens_courrier')
            ->whereNotNull('code_reference')
            ->get()
            ->filter(fn ($c) => CourrierCompteur::referenceDecalee($c->code_reference, $this->dateDe($c)))
            ->sortBy(fn ($c) => $this->cleDeTri($c))
            ->values();
    }

    /**
     * Les courriers à renuméroter parmi ceux qui partagent une référence :
     * tous sauf celui qui la garde (actif avant corbeille, puis le premier
     * saisi). withTrashed() des deux côtés : une référence occupée par un
     * courrier en corbeille le redeviendrait à sa restauration, elle compte
     * donc comme prise.
     */
    private function doublons(): Collection
    {
        $partagees = DocumentArchive::withTrashed()
            ->whereNotNull('sens_courrier')
            ->whereNotNull('code_reference')
            ->groupBy('code_reference')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('code_reference');

        if ($partagees->isEmpty()) {
            return collect();
        }

        return DocumentArchive::withTrashed()
            ->whereIn('code_reference', $partagees)
            ->get()
            ->groupBy('code_reference')
            ->flatMap(fn ($groupe) => $groupe->sortBy(fn ($c) => ($c->deleted_at ? '1' : '0')
                . $c->created_at->format('YmdHis')
                . sprintf('%010d', $c->id))->slice(1))
            ->filter(fn ($c) => $this->moisDe($c) !== null)
            ->sortBy(fn ($c) => $this->cleDeTri($c))
            ->values();
    }

    private function renumeroter(Collection $aCorriger, string $rienAFaire): int
    {
        if ($aCorriger->isEmpty()) {
            $this->info($rienAFaire);
            return self::SUCCESS;
        }

        $confirmer = $this->option('confirmer');
        if (!$confirmer) {
            $this->warn('SIMULATION (aucune écriture) — relancer avec --confirmer pour appliquer réellement.');
            $this->newLine();
        }

        // Compteurs simulés : permet d'afficher les VRAIS numéros en
        // simulation (lecture seule) plutôt qu'un vague "prochain numéro".
        $compteursSimules = [];
        $lignes = [];

        foreach ($aCorriger as $courrier) {
            $ancienne = $courrier->code_reference;
            $mois = $this->moisDe($courrier);

            $nouvelle = $confirmer
                ? $this->prochaineReference($courrier, $mois)
                : $this->prochaineReferenceSimulee($courrier, $mois, $compteursSimules);

            if ($nouvelle === null) {
                $this->error("Courrier {$courrier->id} ({$ancienne}) : aucun numéro libre trouvé, ignoré.");
                continue;
            }

            if ($confirmer) {
                $courrier->update([
                    'code_reference' => $nouvelle,
                    // Le titre reprend la référence quand l'objet est vide
                    // (voir CourrierForm.jsx) — on le garde cohérent.
                    'titre_document' => str_replace($ancienne, $nouvelle, $courrier->titre_document),
                ]);
            }

            $lignes[] = [
                $courrier->id,
                $courrier->sens_courrier,
                $this->dateDe($courrier)?->format('d/m/Y') ?? '(sans date)',
                $ancienne,
                $nouvelle,
            ];
        }

        $this->table(['id', 'sens', 'date', 'ancienne référence', 'nouvelle référence'], $lignes);
        $this->info(($confirmer ? 'Corrigés : ' : 'À corriger : ') . count($lignes));

        return self::SUCCESS;
    }

    /**
     * Le prochain numéro libre du mois, réellement consommé sur le compteur.
     * La boucle ne sert qu'au cas improbable où un courrier détiendrait déjà
     * un numéro au-dessus du compteur (base rafistolée à la main) : les
     * numéros sautés restent perdus, comme ailleurs.
     */
    private function prochaineReference(DocumentArchive $courrier, Carbon $mois): ?string
    {
        for ($i = 0; $i < self::TENTATIVES_MAX; $i++) {
            $reference = CourrierCompteur::genererReference($courrier->sens_courrier, $mois);
            if (!$this->estPrise($reference, $courrier->id)) {
                return $reference;
            }
        }

        return null;
    }

    /**
     * Même calcul sans rien écrire : part de la valeur actuelle du compteur et
     * avance en mémoire, pour que la simulation annonce exactement les numéros
     * que --confirmer attribuera.
     */
    private function prochaineReferenceSimulee(DocumentArchive $courrier, Carbon $mois, array &$compteurs): ?string
    {
        $cle = ($courrier->sens_courrier === 'entrant' ? 'CRE' : 'CRS') . '-' . $mois->format('ym');
        if (!array_key_exists($cle, $compteurs)) {
            $compteurs[$cle] = (int) CourrierCompteur::where('cle', $cle)->value('valeur');
        }

        for ($i = 0; $i < self::TENTATIVES_MAX; $i++) {
            $compteurs[$cle]++;
            $reference = $cle . str_pad($compteurs[$cle], 2, '0', STR_PAD_LEFT);
            if (!$this->estPrise($reference, $courrier->id)) {
                return $reference;
            }
        }

        return null;
    }

    private function estPrise(string $reference, int $saufId): bool
    {
        return DocumentArchive::withTrashed()
            ->where('code_reference', $reference)
            ->where('id', '!=', $saufId)
            ->exists();
    }

    private function dateDe(DocumentArchive $courrier): ?Carbon
    {
        return $courrier->sens_courrier === 'entrant' ? $courrier->date_reception : $courrier->date_envoi;
    }

    /**
     * Le mois dans lequel renuméroter. Normalement celui de la date du
     * courrier ; à défaut, celui que porte sa référence actuelle — sinon
     * genererReference() retomberait sur now() et déplacerait un courrier
     * d'octobre dans la série du mois courant. Ni l'un ni l'autre : on n'y
     * touche pas (voir le filter() de doublons()).
     */
    private function moisDe(DocumentArchive $courrier): ?Carbon
    {
        if ($date = $this->dateDe($courrier)) {
            return $date;
        }

        if (preg_match('/^(?:CRE|CRS)-(\d{2})(\d{2})\d{2,}$/', (string) $courrier->code_reference, $m)) {
            return Carbon::create(2000 + (int) $m[1], (int) $m[2], 1);
        }

        return null;
    }

    /** Ordre chronologique, id en départage, pour une numérotation stable. */
    private function cleDeTri(DocumentArchive $courrier): string
    {
        return $this->moisDe($courrier)->format('Y-m-d') . sprintf('%010d', $courrier->id);
    }
}
