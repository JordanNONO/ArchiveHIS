<?php

namespace App\Services;

use App\Models\ContactSalariePaie;
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
 * (« AWASSI Jean » = « Jean AWASSI ») : les fiches personnel d'abord, puis
 * les sous-dossiers existants, puis la Fluctuation RH.
 *
 * Adresse e-mail, par ordre de priorité : celle du compte, sinon celle
 * saisie à la main (ContactSalariePaie). `mail_suggere` : une adresse écrite
 * dans les observations de la Fluctuation RH — seulement PROPOSÉE à l'écran,
 * jamais utilisée sans confirmation (un texte libre peut contenir l'adresse
 * de quelqu'un d'autre).
 */
class SalariesPaie
{
    private const MOTIF_MAIL = '/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i';

    /** Clé de rapprochement : sans accents, en majuscules, mots triés. */
    public static function cle(?string $nom): string
    {
        $mots = array_values(array_filter(explode(' ', TelephonieAlertes::cleNom($nom)), fn ($m) => $m !== ''));
        sort($mots);

        return implode(' ', $mots);
    }

    /** @return Collection<int, array{cle: string, personnel_id: ?int, nom: string, prenom: ?string, bureau: ?string, mail: ?string, mail_source: ?string, mail_suggere: ?string}> */
    public function univers(?TypeDocument $typeBulletin): Collection
    {
        $contacts = ContactSalariePaie::pluck('mail', 'cle');
        $suggestions = $this->mailsDansLaFluctuation();

        $vus = [];
        $resultat = [];
        $ajouter = function (?int $personnelId, string $nom, ?string $prenom, ?string $bureau, ?string $mailCompte) use (&$vus, &$resultat, $contacts, $suggestions) {
            $nom = trim(preg_replace('/\s+/', ' ', $nom));
            $cle = self::cle($nom);
            if ($cle === '' || isset($vus[$cle])) {
                return;
            }
            $vus[$cle] = true;
            $mailSaisi = $contacts[$cle] ?? null;
            $mail = $mailCompte ?: $mailSaisi;
            $resultat[] = [
                'cle' => $cle,
                'personnel_id' => $personnelId,
                'nom' => $nom,
                'prenom' => $prenom,
                'bureau' => $bureau,
                'mail' => $mail ?: null,
                'mail_source' => $mailCompte ? 'compte' : ($mailSaisi ? 'saisi' : null),
                'mail_suggere' => $mail ? null : ($suggestions[$cle] ?? null),
            ];
        };

        foreach (Personnels::with(['bureau', 'user:id,mail'])->get() as $p) {
            $ajouter($p->id, "{$p->nom} {$p->prenom}", $p->prenom, $p->bureau?->name ?: null, $p->user?->mail ?: null);
        }
        if ($typeBulletin) {
            foreach (TypeDocument::where('parent_id', $typeBulletin->id)->pluck('libelle') as $libelle) {
                $ajouter(null, (string) $libelle, null, null, null);
            }
        }
        foreach (FluctuationRh::select('salarie')->distinct()->pluck('salarie') as $nom) {
            $ajouter(null, (string) $nom, null, null, null);
        }

        usort($resultat, fn ($a, $b) => strcmp(TelephonieAlertes::cleNom($a['nom']), TelephonieAlertes::cleNom($b['nom'])));

        return collect($resultat);
    }

    /** cle du salarié => première adresse trouvée dans les observations de ses lignes de Fluctuation RH. */
    private function mailsDansLaFluctuation(): array
    {
        $trouves = [];
        FluctuationRh::where('observations', 'like', '%@%')
            ->orderBy('id')
            ->get(['salarie', 'observations'])
            ->each(function (FluctuationRh $ligne) use (&$trouves) {
                $cle = self::cle($ligne->salarie);
                if ($cle === '' || isset($trouves[$cle])) {
                    return;
                }
                if (preg_match(self::MOTIF_MAIL, (string) $ligne->observations, $m)) {
                    $trouves[$cle] = mb_strtolower($m[0]);
                }
            });

        return $trouves;
    }
}
