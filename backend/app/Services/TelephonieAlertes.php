<?php

namespace App\Services;

use App\Models\FluctuationRh;
use App\Models\TelephonieDetention;
use App\Models\TelephonieLigne;
use Illuminate\Support\Collection;

/**
 * Ce qui demande une action sur le parc — la partie de la vue d'ensemble qui
 * sert vraiment à quelque chose.
 *
 * Trois alertes, et chacune répond à un oubli qu'un suivi de tête ne rattrape
 * jamais :
 *
 *  - du matériel qui n'est pas revenu après un départ ;
 *  - une ligne active que plus personne ne détient, donc un forfait payé pour
 *    rien (c'est l'alerte qui se rentabilise toute seule : 19,90 € par mois
 *    oubliés pendant un an font 239 €) ;
 *  - un engagement qui arrive à échéance, seul moment où renégocier ou
 *    résilier coûte zéro.
 */
class TelephonieAlertes
{
    /** Au-delà, l'échéance est trop lointaine pour être actionnable. */
    private const JOURS_AVANT_ECHEANCE = 60;

    /**
     * Nom comparable : sans accents, en majuscules, espaces réduits.
     *
     * Indispensable parce que la sortie d'un salarié n'est écrite nulle part
     * dans `personnels` — elle vit dans la Fluctuation RH, section `sortie`,
     * avec un nom saisi à la main. Le rapprochement se fait donc sur le texte,
     * faute de clé étrangère. Même normalisation que la migration de reprise
     * des incidents, pour que les deux tombent d'accord.
     */
    public static function cleNom(?string $nom): string
    {
        $sans = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', (string) $nom) ?: (string) $nom;
        $sans = preg_replace('/[^A-Za-z ]/', ' ', $sans);

        return trim(preg_replace('/\s+/', ' ', strtoupper($sans)));
    }

    public function toutes(): array
    {
        return [
            'materiel_non_restitue' => $this->materielNonRestitue()->values()->all(),
            'lignes_facturees_inutilement' => $this->lignesFactureesInutilement()->values()->all(),
            'engagements_proches' => $this->engagementsProches()->values()->all(),
        ];
    }

    public function nombre(): int
    {
        $toutes = $this->toutes();

        return count($toutes['materiel_non_restitue'])
            + count($toutes['lignes_facturees_inutilement'])
            + count($toutes['engagements_proches']);
    }

    /**
     * Du matériel encore détenu par quelqu'un dont la Fluctuation RH a
     * enregistré la sortie. Le départ déclenche la restitution, pas l'inverse :
     * c'est donc la section `sortie` qui fait foi, et non un état du parc que
     * personne n'aura pensé à mettre à jour.
     */
    public function materielNonRestitue(): Collection
    {
        $sorties = [];
        $lignesSortie = FluctuationRh::where('section', 'sortie')
            ->whereNotNull('date_fin')
            ->whereDate('date_fin', '<=', now())
            ->get(['salarie', 'date_fin']);

        foreach ($lignesSortie as $sortie) {
            $cle = self::cleNom($sortie->salarie);
            if ($cle === '') {
                continue;
            }
            // La sortie la plus récente l'emporte : un salarié peut être parti,
            // être revenu, et repartir.
            if (!isset($sorties[$cle]) || $sortie->date_fin > $sorties[$cle]) {
                $sorties[$cle] = $sortie->date_fin;
            }
        }

        if (empty($sorties)) {
            return collect();
        }

        return TelephonieDetention::enCours()
            ->with(['personnel:id,nom,prenom', 'appareil:id,modele,imei', 'ligne:id,numero,operateur'])
            ->get()
            ->map(function (TelephonieDetention $detention) use ($sorties) {
                $nom = $detention->nomSalarie();
                // Les deux ordres : la saisie libre écrit tantôt "MARTIN Sophie",
                // tantôt "Sophie MARTIN".
                $cles = [self::cleNom($nom)];
                if ($detention->personnel) {
                    $cles[] = self::cleNom("{$detention->personnel->prenom} {$detention->personnel->nom}");
                }

                foreach ($cles as $cle) {
                    if ($cle !== '' && isset($sorties[$cle])) {
                        $detention->setAttribute('sorti_le', $sorties[$cle]);

                        return $detention;
                    }
                }

                return null;
            })
            ->filter();
    }

    /**
     * Lignes actives que personne ne détient et qui coûtent quelque chose.
     * `detentions` sert à dater l'oubli : depuis quand ce forfait tourne-t-il
     * dans le vide.
     */
    public function lignesFactureesInutilement(): Collection
    {
        return TelephonieLigne::facturationInutile()
            ->with(['detentions' => fn ($q) => $q->orderByDesc('date_fin')->limit(1)])
            ->get()
            ->map(function (TelephonieLigne $ligne) {
                $derniere = $ligne->detentions->first();
                $ligne->setAttribute('libre_depuis', $derniere?->date_fin);
                $ligne->setAttribute('perdu_depuis_libre', $this->perduDepuis($derniere?->date_fin, $ligne->cout_mensuel));

                return $ligne;
            });
    }

    /** Ce que l'oubli a déjà coûté, en euros — plus parlant qu'une date. */
    private function perduDepuis($depuis, $coutMensuel): ?float
    {
        if (!$depuis || !$coutMensuel) {
            return null;
        }

        $mois = max(0, $depuis->diffInMonths(now()));

        return round($mois * (float) $coutMensuel, 2);
    }

    /**
     * Engagements qui se terminent bientôt. Regroupés par date d'échéance :
     * quatre lignes qui tombent le même jour sont une seule négociation à
     * mener, pas quatre alertes à lire.
     */
    public function engagementsProches(): Collection
    {
        return TelephonieLigne::where('statut', 'active')
            ->whereNotNull('engagement_jusquau')
            ->whereDate('engagement_jusquau', '>=', now())
            ->whereDate('engagement_jusquau', '<=', now()->addDays(self::JOURS_AVANT_ECHEANCE))
            ->orderBy('engagement_jusquau')
            ->get(['id', 'numero', 'operateur', 'forfait', 'cout_mensuel', 'engagement_jusquau'])
            ->groupBy(fn (TelephonieLigne $l) => $l->engagement_jusquau->format('Y-m-d'))
            ->map(fn (Collection $lignes, string $date) => [
                'echeance' => $date,
                'jours_restants' => now()->startOfDay()->diffInDays($date, false),
                'operateur' => $lignes->first()->operateur,
                'nombre' => $lignes->count(),
                'cout_mensuel_total' => round($lignes->sum(fn ($l) => (float) $l->cout_mensuel), 2),
                'lignes' => $lignes->values(),
            ])
            ->values();
    }
}
