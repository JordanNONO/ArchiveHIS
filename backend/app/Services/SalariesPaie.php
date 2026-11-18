<?php

namespace App\Services;

use App\Models\FluctuationRh;
use App\Models\Personnels;
use App\Models\TypeDocument;
use Illuminate\Support\Collection;

/**
 * Qui peut recevoir un bulletin de paie — bien plus large que `personnels`
 * (les comptes de l'application) : la plupart des intervenants n'ont pas de
 * compte et n'existent que dans la Fluctuation RH ou dans un sous-dossier de
 * « Bulletin de paie ». Ne regarder que `personnels` laissait ~9 bulletins sur
 * 10 « non reconnus » au premier dépôt réel.
 *
 * Trois sources, dédoublonnées sur le nom quel que soit l'ordre des mots
 * (« AWASSI Jean » = « Jean AWASSI ») : les fiches personnel d'abord (seules
 * à porter une adresse mail), puis les sous-dossiers existants, puis la
 * Fluctuation RH.
 */
class SalariesPaie
{
    /** Clé de rapprochement : sans accents, en majuscules, mots triés. */
    public static function cle(?string $nom): string
    {
        $mots = array_values(array_filter(explode(' ', TelephonieAlertes::cleNom($nom)), fn ($m) => $m !== ''));
        sort($mots);

        return implode(' ', $mots);
    }

    /** @return Collection<int, array{cle: string, personnel_id: ?int, nom: string, bureau: ?string, mail: ?string}> */
    public function univers(?TypeDocument $typeBulletin): Collection
    {
        $vus = [];
        $resultat = [];
        $ajouter = function (?int $personnelId, string $nom, ?string $bureau, ?string $mail) use (&$vus, &$resultat) {
            $nom = trim(preg_replace('/\s+/', ' ', $nom));
            $cle = self::cle($nom);
            if ($cle === '' || isset($vus[$cle])) {
                return;
            }
            $vus[$cle] = true;
            $resultat[] = ['cle' => $cle, 'personnel_id' => $personnelId, 'nom' => $nom, 'bureau' => $bureau, 'mail' => $mail];
        };

        foreach (Personnels::with(['bureau', 'user:id,mail'])->get() as $p) {
            $ajouter($p->id, "{$p->nom} {$p->prenom}", $p->bureau?->name ?: null, $p->user?->mail ?: null);
        }
        if ($typeBulletin) {
            foreach (TypeDocument::where('parent_id', $typeBulletin->id)->pluck('libelle') as $libelle) {
                $ajouter(null, (string) $libelle, null, null);
            }
        }
        foreach (FluctuationRh::select('salarie')->distinct()->pluck('salarie') as $nom) {
            $ajouter(null, (string) $nom, null, null);
        }

        usort($resultat, fn ($a, $b) => strcmp(TelephonieAlertes::cleNom($a['nom']), TelephonieAlertes::cleNom($b['nom'])));

        return collect($resultat);
    }
}
