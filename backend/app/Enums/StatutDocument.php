<?php

namespace App\Enums;

enum StatutDocument: string
{
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
            // La décision (Validé et traité / Rejeté) est directement accessible
            // depuis chaque étape intermédiaire : un document (surtout un dépôt
            // externe intervenant/bénéficiaire, ex: une demande de congés) n'a pas
            // toujours besoin du circuit de validation complet. En revanche ARCHIVE
            // n'est volontairement PAS proposé avant cette décision — on valide ou
            // on rejette d'abord, l'archivage n'arrive qu'ensuite (depuis VALIDE_ET_TRAITE).
            self::SOUMIS->value => [self::TRANSMIS_AU_SERVICE->value, self::INCOMPLET_REJETE->value, self::VALIDE_ET_TRAITE->value],
            self::TRANSMIS_AU_SERVICE->value => [self::EN_COURS_DE_TRAITEMENT->value, self::VALIDE_ET_TRAITE->value, self::INCOMPLET_REJETE->value],
            self::EN_COURS_DE_TRAITEMENT->value => [self::VALIDE_ET_TRAITE->value, self::INCOMPLET_REJETE->value],
            // Sans statut brouillon, un document rejeté repart directement vers "Soumis"
            // une fois corrigé (fichier remplacé via le suivi de versions), plutôt que
            // par un aller-retour brouillon qui n'existe plus.
            self::INCOMPLET_REJETE->value => [self::SOUMIS->value],
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
            self::SOUMIS => 'Soumis',
            self::TRANSMIS_AU_SERVICE => 'Transmis au service',
            self::EN_COURS_DE_TRAITEMENT => 'En cours de traitement',
            self::INCOMPLET_REJETE => 'Incomplet / Rejeté',
            self::VALIDE_ET_TRAITE => 'Validé et traité',
            self::ARCHIVE => 'Archivé',
            self::EXPIRE_A_PURGER => 'Expiré à purger',
        };
    }

    /**
     * Libellé simplifié pour un compte externe (intervenant, bénéficiaire) —
     * en miroir de STATUT_LABELS_EXTERNE côté front (StatutBadge.jsx). Le
     * circuit de validation interne ne le regarde pas : "validé" et "archivé"
     * veulent tous les deux dire "traité" de son point de vue.
     */
    public function libelleExterne(): string
    {
        return match ($this) {
            self::SOUMIS => 'Reçu',
            self::TRANSMIS_AU_SERVICE, self::EN_COURS_DE_TRAITEMENT => 'En cours de traitement',
            self::INCOMPLET_REJETE => 'À compléter',
            self::VALIDE_ET_TRAITE, self::ARCHIVE, self::EXPIRE_A_PURGER => 'Traité',
        };
    }
}
