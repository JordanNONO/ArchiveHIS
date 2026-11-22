<?php

namespace App\Services;

use App\Models\DocumentArchive;
use App\Models\Utilisateurs;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Documents à date de fin de validité (titre de séjour, visite médicale,
 * formation, permis...) — règles partagées par « Mes papiers »
 * (MonEspaceController) et la commande de rappels
 * (documents:rappeler-validite).
 *
 * Un document est « remplacé » dès qu'un document plus récent de la même
 * famille, pour la même personne, a une date de fin plus lointaine : le
 * nouveau titre de séjour classé coupe ainsi les rappels de l'ancien, sans
 * que la RH ait à effacer quoi que ce soit.
 */
class EcheancesDocuments
{
    /** Paliers de rappel, en jours avant la date de fin (0 = le jour même / dépassé). */
    public const PALIERS = [60, 30, 7, 0];

    /** Au-delà, un document expiré n'est plus rappelé ni signalé (donnée ancienne). */
    public const OUBLI_APRES_JOURS = 60;

    /** Mots-clés → famille. L'ordre compte : le premier qui correspond gagne. */
    private const FAMILLES = [
        'titre-sejour' => ['titre de sejour', 'titre sejour', 'carte de sejour', 'recepisse', 'autorisation de travail', 'apt'],
        'visite-medicale' => ['visite medicale', 'medecine du travail', 'aptitude'],
        'permis' => ['permis'],
        'identite' => ['carte d identite', 'cni', 'passeport', 'piece d identite'],
        'psc1' => ['psc1', 'psc 1'],
        'sst' => ['sst', 'sauveteur secouriste'],
        'formation' => ['formation', 'habilitation', 'attestation de stage'],
        'vaccin' => ['vaccin'],
        'assurance' => ['assurance'],
    ];

    /** Types pour lesquels la case « date de fin de validité » est cochée d'office côté RH. */
    public const FAMILLES_COCHEES_DOFFICE = ['titre-sejour', 'visite-medicale', 'permis', 'psc1', 'sst', 'formation'];

    public static function famille(DocumentArchive $document): ?string
    {
        $texte = Str::of($document->titre_document . ' ' . ($document->typeDocument?->libelle ?? ''))
            ->ascii()->lower()->replaceMatches('/[^a-z0-9]+/', ' ')->trim()->toString();
        $texte = " {$texte} ";

        foreach (self::FAMILLES as $famille => $motsCles) {
            foreach ($motsCles as $mot) {
                if (str_contains($texte, " {$mot} ")) {
                    return $famille;
                }
            }
        }

        return null;
    }

    /** Clé « même personne » : le salarié concerné, sinon le déposant. */
    public static function clePersonne(DocumentArchive $document): string
    {
        return $document->personnel_concerne_id
            ? 'p' . $document->personnel_concerne_id
            : 'u' . $document->utilisateur_id;
    }

    /**
     * Garde, pour chaque personne et chaque famille, le document dont la
     * date de fin est la plus lointaine. Un document sans famille reconnue
     * reste toujours seul dans la sienne.
     */
    public static function nonRemplaces(Collection $documents): Collection
    {
        return $documents
            ->filter(fn (DocumentArchive $d) => $d->date_fin_validite !== null)
            ->groupBy(fn (DocumentArchive $d) => self::clePersonne($d) . '|' . (self::famille($d) ?? 'doc' . $d->id))
            ->map(fn (Collection $groupe) => $groupe->sortByDesc(fn ($d) => $d->date_fin_validite->timestamp)->first())
            ->values();
    }

    /** Jours restants (négatif une fois la date passée). */
    public static function joursRestants(DocumentArchive $document): int
    {
        return (int) now()->startOfDay()->diffInDays($document->date_fin_validite->copy()->startOfDay(), false);
    }

    /** Palier atteint aujourd'hui (60, 30, 7, 0) ou null si encore loin. */
    public static function palierAtteint(int $joursRestants): ?int
    {
        $atteint = null;
        foreach (self::PALIERS as $palier) {
            if ($joursRestants <= $palier) {
                $atteint = $palier;
            }
        }

        return $atteint;
    }

    /**
     * Compte Utilisateurs à prévenir côté salarié : celui du salarié concerné,
     * sinon le déposant lui-même quand c'est un compte dépôt (intervenant qui
     * a déposé son propre titre de séjour).
     */
    public static function utilisateurConcerne(DocumentArchive $document): ?Utilisateurs
    {
        $id = $document->personnelConcerne?->utilisateur_id;
        if ($id) {
            return Utilisateurs::find($id);
        }

        $deposant = $document->utilisateur;

        return $deposant && $deposant->estCompteDepot() ? $deposant : null;
    }
}
