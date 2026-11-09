<?php

namespace App\Support;

use App\Models\AppelTelephonique;
use App\Models\Personnels;

/**
 * "Pour qui" d'une notification (maquette "Notifications HIS — nouveau
 * modèle") : le prénom en tête du titre, un avatar à ses initiales et à sa
 * couleur — rond pour une personne, carré pour un secteur, « VOUS » en bleu
 * pour ce qui concerne directement le destinataire. Le même tableau sert à la
 * notification système (WebPushChannel + sw.js) ET à la cloche dans l'appli
 * (NotificationBell.jsx), pour qu'une personne ait partout la même couleur.
 */
class CibleNotification
{
    /** Bleu réservé à « VOUS » : ne figure pas dans la palette des personnes. */
    public const COULEUR_VOUS = '#2563EB';

    /**
     * Teintes assez foncées pour du texte blanc (contraste ≥ 4.5:1), distinctes
     * entre elles et du bleu « VOUS ». L'appli les éclaircit en mode sombre.
     */
    private const PALETTE = [
        '#5B3FD1', '#0F766E', '#B45309', '#BE185D', '#4D7C0F',
        '#0E7490', '#9F1239', '#7E22CE', '#C2410C', '#475569',
    ];

    public static function vous(): array
    {
        return [
            'cle' => 'vous',
            'libelle' => 'POUR VOUS',
            'initiales' => 'VOUS',
            'forme' => 'rond',
            'couleur' => self::COULEUR_VOUS,
            'vous' => true,
        ];
    }

    public static function personne(string $cle, ?string $prenom, ?string $nom = null): array
    {
        $prenom = trim((string) $prenom);
        $nom = trim((string) $nom);
        $libelle = $prenom !== '' ? $prenom : $nom;

        return [
            'cle' => $cle,
            'libelle' => mb_strtoupper($libelle),
            'initiales' => self::initiales($prenom, $nom),
            'forme' => 'rond',
            'couleur' => self::couleur($cle),
            'vous' => false,
        ];
    }

    public static function secteur(string $nom): array
    {
        $cle = 'secteur:' . mb_strtolower(trim($nom));

        return [
            'cle' => $cle,
            'libelle' => 'SECTEUR ' . mb_strtoupper(trim($nom)),
            'initiales' => mb_strtoupper(mb_substr(preg_replace('/[^\p{L}\p{N}]/u', '', $nom), 0, 2)),
            'forme' => 'carre',
            'couleur' => self::couleur($cle),
            'vous' => false,
        ];
    }

    /**
     * Même ordre de priorité que AppelTelephoniqueNotification::personneConcernee() :
     * service entier, groupe, plusieurs personnes, une personne, nom libre.
     * Null quand l'appel ne désigne personne (l'appli retombe alors sur « VOUS »).
     */
    public static function pourAppel(AppelTelephonique $appel, $destinataire): ?array
    {
        if ($appel->serviceMetierConcerne) {
            return self::secteur($appel->serviceMetierConcerne->nom_service);
        }
        if ($appel->groupe_concerne === AppelTelephonique::GROUPE_RESPONSABLES_SECTEUR) {
            return self::secteur('Resp. secteur');
        }

        $personnels = collect();
        if (!empty($appel->personnels_concernes_ids)) {
            $personnels = $appel->personnelsConcernes();
        } elseif ($appel->personnelConcerne) {
            $personnels = collect([$appel->personnelConcerne]);
        }

        if ($personnels->isNotEmpty()) {
            $destinataireId = $destinataire->id ?? null;
            if ($destinataireId && $personnels->contains(fn ($p) => (int) $p->utilisateur_id === (int) $destinataireId)) {
                return self::vous();
            }
            $premier = $personnels->first();
            $cible = self::personne('personnel:' . $premier->id, $premier->prenom, $premier->nom);
            if ($personnels->count() > 1) {
                $cible['libelle'] .= ' +' . ($personnels->count() - 1);
            }

            return $cible;
        }

        if ($appel->personne_concernee_texte) {
            $morceaux = preg_split('/\s+/', trim($appel->personne_concernee_texte));

            return self::personne('texte:' . mb_strtolower(trim($appel->personne_concernee_texte)), $morceaux[0] ?? '', $morceaux[1] ?? '');
        }

        return null;
    }

    /** Cible d'une personne de la table personnels, pour un autre type de notification. */
    public static function pourPersonnel(?Personnels $personnel, $destinataire): ?array
    {
        if (!$personnel) {
            return null;
        }
        if ($destinataire && (int) $personnel->utilisateur_id === (int) $destinataire->id) {
            return self::vous();
        }

        return self::personne('personnel:' . $personnel->id, $personnel->prenom, $personnel->nom);
    }

    public static function couleur(string $cle): string
    {
        return self::PALETTE[crc32($cle) % count(self::PALETTE)];
    }

    private static function initiales(string $prenom, string $nom): string
    {
        $lettre = fn (string $mot) => mb_strtoupper(mb_substr($mot, 0, 1));
        if ($prenom !== '' && $nom !== '') {
            return $lettre($prenom) . $lettre($nom);
        }
        $seul = $prenom !== '' ? $prenom : $nom;

        return mb_strtoupper(mb_substr($seul, 0, 2));
    }

    /** « J+3 » au-delà d'un jour, sinon « aujourd'hui ». */
    public static function anciennete(?\DateTimeInterface $depuis): string
    {
        if (!$depuis) {
            return '';
        }
        $jours = (int) floor(now()->startOfDay()->diffInDays(\Carbon\Carbon::instance($depuis)->startOfDay(), true));

        return $jours >= 1 ? "J+{$jours}" : "aujourd'hui";
    }
}
