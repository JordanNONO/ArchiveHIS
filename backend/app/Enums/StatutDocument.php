<?php

namespace App\Enums;

enum StatutDocument: string
{
    case BROUILLON = 'BROUILLON';
    case SOUMIS = 'SOUMIS';
    case TRANSMIS_AU_SERVICE = 'TRANSMIS_AU_SERVICE';
    case EN_COURS_DE_TRAITEMENT = 'EN_COURS_DE_TRAITEMENT';
    case INCOMPLET_REJETE = 'INCOMPLET_REJETE';
    case VALIDE_ET_TRAITE = 'VALIDE_ET_TRAITE';
    case ARCHIVE = 'ARCHIVE';
    case EXPIRE_A_PURGER = 'EXPIRE_A_PURGER';

    /**
     * Transitions autorisées depuis chaque statut du workflow documentaire.
     *
     * @return array<string, string[]>
     */
    public static function transitions(): array
    {
        return [
            self::BROUILLON->value => [self::SOUMIS->value],
            self::SOUMIS->value => [self::TRANSMIS_AU_SERVICE->value, self::INCOMPLET_REJETE->value],
            self::TRANSMIS_AU_SERVICE->value => [self::EN_COURS_DE_TRAITEMENT->value],
            self::EN_COURS_DE_TRAITEMENT->value => [self::VALIDE_ET_TRAITE->value, self::INCOMPLET_REJETE->value],
            self::INCOMPLET_REJETE->value => [self::BROUILLON->value],
            self::VALIDE_ET_TRAITE->value => [self::ARCHIVE->value],
            self::ARCHIVE->value => [self::EXPIRE_A_PURGER->value],
            self::EXPIRE_A_PURGER->value => [],
        ];
    }

    public static function peutTransitionerVers(string $ancien, string $nouveau): bool
    {
        return in_array($nouveau, self::transitions()[$ancien] ?? [], true);
    }
}
