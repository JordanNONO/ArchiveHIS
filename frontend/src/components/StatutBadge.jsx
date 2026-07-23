import React from 'react';

export const STATUT_LABELS = {
  BROUILLON: 'Brouillon',
  SOUMIS: 'Soumis',
  TRANSMIS_AU_SERVICE: 'Transmis au service',
  EN_COURS_DE_TRAITEMENT: 'En cours de traitement',
  INCOMPLET_REJETE: 'Incomplet / Rejeté',
  VALIDE_ET_TRAITE: 'Validé et traité',
  ARCHIVE: 'Archivé',
  EXPIRE_A_PURGER: 'Expiré à purger',
};

const STATUT_CLASSES = {
  BROUILLON: 'bg-muted text-muted-foreground',
  SOUMIS: 'bg-secondary text-secondary-foreground',
  TRANSMIS_AU_SERVICE: 'bg-secondary text-secondary-foreground',
  EN_COURS_DE_TRAITEMENT: 'bg-accent text-accent-foreground',
  INCOMPLET_REJETE: 'bg-destructive text-destructive-foreground',
  VALIDE_ET_TRAITE: 'bg-primary text-primary-foreground',
  ARCHIVE: 'bg-primary text-primary-foreground',
  EXPIRE_A_PURGER: 'bg-destructive text-destructive-foreground',
};

/**
 * Transitions autorisées depuis chaque statut, en miroir du backend (StatutDocument::transitions()).
 */
export const STATUT_TRANSITIONS = {
  BROUILLON: ['SOUMIS'],
  SOUMIS: ['TRANSMIS_AU_SERVICE', 'INCOMPLET_REJETE'],
  TRANSMIS_AU_SERVICE: ['EN_COURS_DE_TRAITEMENT'],
  EN_COURS_DE_TRAITEMENT: ['VALIDE_ET_TRAITE', 'INCOMPLET_REJETE'],
  INCOMPLET_REJETE: ['BROUILLON'],
  VALIDE_ET_TRAITE: ['ARCHIVE'],
  ARCHIVE: ['EXPIRE_A_PURGER'],
  EXPIRE_A_PURGER: [],
};

function StatutBadge({ statut, className = '' }) {
  if (!statut) return null;
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${STATUT_CLASSES[statut] || 'bg-muted text-muted-foreground'} ${className}`}>
      {STATUT_LABELS[statut] || statut}
    </span>
  );
}

export default StatutBadge;
