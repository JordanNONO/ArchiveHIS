<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Sort la section "telephone" de la Fluctuation RH et la verse dans
 * telephonie_incidents — demande explicite (2026-11-16) : ces incidents
 * portent sur du matériel, ils appartiennent au parc, pas au mouvement du
 * personnel du mois.
 *
 * Volontairement sans les modèles Eloquent : une migration doit continuer de
 * tourner telle quelle dans un an, quand FluctuationRh aura changé de forme.
 *
 * Le rattachement à une fiche du personnel se fait par comparaison de noms
 * normalisés (la Fluctuation RH stocke un nom en texte libre). Ce qui ne
 * correspond à personne n'est pas perdu : le nom écrit part dans
 * `salarie_nom`, et l'incident reste consultable.
 */
return new class extends Migration
{
    /** NOM PRENOM comparable : sans accents, en majuscules, espaces réduits. */
    private function cle(?string $nom): string
    {
        $sans = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', (string) $nom) ?: (string) $nom;
        $sans = preg_replace('/[^A-Za-z ]/', ' ', $sans);

        return trim(preg_replace('/\s+/', ' ', strtoupper($sans)));
    }

    private function natureDepuisMotif(?string $motif): string
    {
        $m = mb_strtolower((string) $motif);

        if (str_contains($m, 'perte') || str_contains($m, 'perdu')) {
            return 'perte';
        }
        if (str_contains($m, 'vol')) {
            return 'vol';
        }
        if (str_contains($m, 'cass')) {
            return 'casse';
        }
        if (str_contains($m, 'forfait') || str_contains($m, 'passement')) {
            return 'depassement_forfait';
        }

        return 'autre';
    }

    public function up(): void
    {
        $lignes = DB::table('fluctuations_rh')->where('section', 'telephone')->get();
        if ($lignes->isEmpty()) {
            return;
        }

        // Index des fiches du personnel, dans les deux ordres : la saisie libre
        // écrit tantôt "MARTIN Sophie", tantôt "Sophie MARTIN".
        $parNom = [];
        foreach (DB::table('personnels')->select('id', 'nom', 'prenom')->get() as $p) {
            foreach ([$this->cle("{$p->nom} {$p->prenom}"), $this->cle("{$p->prenom} {$p->nom}")] as $cle) {
                if ($cle !== '' && !isset($parNom[$cle])) {
                    $parNom[$cle] = $p->id;
                }
            }
        }

        $maintenant = now();
        $reprises = [];
        $idsRepris = [];

        foreach ($lignes as $l) {
            $reprises[] = [
                'personnel_id' => $parNom[$this->cle($l->salarie)] ?? null,
                'salarie_nom' => $l->salarie,
                'appareil_id' => null,
                'ligne_id' => null,
                // date_debut quand elle existe, sinon le 1er du mois traité :
                // un incident sans date ne serait classable nulle part.
                'date_incident' => $l->date_debut ?: $l->mois,
                'nature' => $this->natureDepuisMotif($l->motif),
                'montant' => $l->montant,
                // "a_decider" et non "retenue_salaire" : un montant saisi dans
                // la fluctuation ne dit pas s'il a été retenu ou pris en charge.
                // Mieux vaut une liste à trancher qu'une affirmation inventée.
                'suite_donnee' => 'a_decider',
                'fluctuation_rh_id' => null,
                'justificatif_document_id' => null,
                'observations' => trim(($l->motif ? "Motif d'origine : {$l->motif}." : '') . ' ' . (string) $l->observations) ?: null,
                'cree_par_id' => $l->utilisateur_id,
                'created_at' => $l->created_at ?: $maintenant,
                'updated_at' => $maintenant,
            ];
            $idsRepris[] = $l->id;
        }

        DB::transaction(function () use ($reprises, $idsRepris) {
            foreach (array_chunk($reprises, 200) as $paquet) {
                DB::table('telephonie_incidents')->insert($paquet);
            }
            // Supprimées seulement après insertion réussie, dans la même
            // transaction : jamais de lignes perdues entre les deux.
            DB::table('fluctuations_rh')->whereIn('id', $idsRepris)->delete();
        });
    }

    /**
     * Remet les incidents repris dans la Fluctuation RH. Seuls ceux qui en
     * venaient sont concernés : ils se reconnaissent à l'absence d'appareil et
     * de ligne rattachés, les seuls que la fluctuation ne savait pas porter.
     */
    public function down(): void
    {
        $incidents = DB::table('telephonie_incidents')
            ->whereNull('appareil_id')
            ->whereNull('ligne_id')
            ->get();

        if ($incidents->isEmpty()) {
            return;
        }

        $motifs = [
            'perte' => 'Perte téléphone',
            'casse' => 'Téléphone cassé',
            'vol' => 'Perte téléphone',
            'depassement_forfait' => 'Dépassement forfait téléphonique',
        ];

        $retours = [];
        foreach ($incidents as $i) {
            $retours[] = [
                'mois' => date('Y-m-01', strtotime($i->date_incident)),
                'section' => 'telephone',
                'salarie' => $i->salarie_nom ?: '—',
                'date_debut' => $i->date_incident,
                'date_fin' => null,
                'motif' => $motifs[$i->nature] ?? 'Perte téléphone',
                'heures' => null,
                'montant' => $i->montant,
                'observations' => $i->observations,
                'utilisateur_id' => $i->cree_par_id,
                'modifie_par_id' => null,
                'created_at' => $i->created_at,
                'updated_at' => now(),
            ];
        }

        DB::transaction(function () use ($retours, $incidents) {
            foreach (array_chunk($retours, 200) as $paquet) {
                DB::table('fluctuations_rh')->insert($paquet);
            }
            DB::table('telephonie_incidents')->whereIn('id', $incidents->pluck('id'))->delete();
        });
    }
};
