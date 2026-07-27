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

    /**
     * Regroupement à 3 niveaux utilisé pour les indicateurs agrégés (ex: badge de dossier) :
     * "attention" (rejeté/expiré) > "en_cours" (pas encore traité) > "traite" (validé/archivé).
     */
    public function groupe(): string
    {
        return match ($this) {
            self::INCOMPLET_REJETE, self::EXPIRE_A_PURGER => 'attention',
            self::VALIDE_ET_TRAITE, self::ARCHIVE => 'traite',
            default => 'en_cours',
        };
    }

    /**
     * @return string[] valeurs de statut appartenant au groupe donné.
     */
    public static function parGroupe(string $groupe): array
    {
        return array_values(array_map(
            fn (self $c) => $c->value,
            array_filter(self::cases(), fn (self $c) => $c->groupe() === $groupe)
        ));
    }

    /**
     * Libellé français, utilisé notamment dans les notifications.
     */
    public function libelle(): string
    {
        return match ($this) {
            self::BROUILLON => 'Brouillon',
            self::SOUMIS => 'Soumis',
            self::TRANSMIS_AU_SERVICE => 'Transmis au service',
            self::EN_COURS_DE_TRAITEMENT => 'En cours de traitement',
            self::INCOMPLET_REJETE => 'Incomplet / Rejeté',
            self::VALIDE_ET_TRAITE => 'Validé et traité',
            self::ARCHIVE => 'Archivé',
            self::EXPIRE_A_PURGER => 'Expiré à purger',
        };
    }
}
