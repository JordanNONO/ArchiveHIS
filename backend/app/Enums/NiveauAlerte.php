<?php

namespace App\Enums;

enum NiveauAlerte: string
{
    case VERT = 'VERT';
    case ORANGE = 'ORANGE';
    case ROUGE = 'ROUGE';

    /**
     * Calcule le niveau d'alerte d'une étape en fonction de son échéance et,
     * quand elle existe, du seuil à partir duquel elle passe orange (ex: "rappel
     * à J-3" sur un délai de 15 jours). Sans seuil, l'étape reste verte jusqu'à
     * l'échéance puis bascule directement rouge (ex: le courrier initial à 48h,
     * qui n'a pas de palier intermédiaire dans la procédure décrite par le client).
     */
    public static function calculer(\DateTimeInterface $echeance, ?\DateTimeInterface $seuilAlerte, \DateTimeInterface $maintenant): self
    {
        if ($maintenant >= $echeance) {
            return self::ROUGE;
        }

        if ($seuilAlerte !== null && $maintenant >= $seuilAlerte) {
            return self::ORANGE;
        }

        return self::VERT;
    }

    public function libelle(): string
    {
        return match ($this) {
            self::VERT => 'Dans les temps',
            self::ORANGE => "Proche de l'échéance",
            self::ROUGE => 'Délai dépassé',
        };
    }
}
