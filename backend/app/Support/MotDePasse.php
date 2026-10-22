<?php

namespace App\Support;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Règle commune à tous les endroits où un mot de passe est choisi (profil,
 * inscription, mot de passe oublié) : 12 caractères minimum, au moins une
 * lettre et un chiffre, et refus des mots de passe les plus courants.
 * Messages directement en français : l'application n'a pas de fichiers de
 * traduction Laravel (lang/), les messages par défaut sortiraient en anglais.
 */
class MotDePasse implements ValidationRule
{
    public const LONGUEUR_MIN = 12;

    /** Mots de passe (ou racines) trop courants, comparés sans casse ni chiffres/symboles de fin. */
    private const COURANTS = [
        'password', 'motdepasse', 'azerty', 'azertyuiop', 'qwerty', 'qwertyuiop',
        'abcdef', 'abcdefgh', 'abc123', 'bonjour', 'soleil', 'doudou', 'loulou',
        'admin', 'administrateur', 'welcome', 'bienvenue', 'iloveyou', 'jetaime',
        'marseille', 'football', 'chouchou', 'hisvie', 'archive', 'changeme',
    ];

    public static function regle(): self
    {
        return new self();
    }

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $valeur = (string) $value;

        if (mb_strlen($valeur) < self::LONGUEUR_MIN) {
            $fail('Le mot de passe doit contenir au moins ' . self::LONGUEUR_MIN . ' caractères.');
            return;
        }

        if (!preg_match('/\pL/u', $valeur) || !preg_match('/\d/', $valeur)) {
            $fail('Le mot de passe doit contenir au moins une lettre et un chiffre.');
            return;
        }

        // "Azerty123456!" ou "Password2024" se ramènent à une racine courante.
        $racine = mb_strtolower(preg_replace('/^[\d\W_]+|[\d\W_]+$/u', '', $valeur));
        if (in_array($racine, self::COURANTS, true)) {
            $fail('Ce mot de passe est trop courant, choisissez-en un autre.');
        }
    }
}
