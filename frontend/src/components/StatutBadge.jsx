import React from 'react';
import { LuFileEdit, LuSend, LuBuilding2, LuClock, LuXCircle, LuCheckCircle2, LuArchive, LuTrash2 } from 'react-icons/lu';

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

/**
 * Chaque statut a une couleur et une icône qui lui sont propres (pas de doublon),
 * avec une sémantique cohérente : bleu = en transit, or = en cours/attention,
 * vert = succès, rouge = problème, noir = classé, rouge cerclé = fin de vie.
 */
const STATUT_STYLES = {
  BROUILLON: { classes: 'bg-muted text-muted-foreground border border-border', icon: LuFileEdit },
  SOUMIS: { classes: 'bg-secondary text-secondary-foreground', icon: LuSend },
  TRANSMIS_AU_SERVICE: { classes: 'bg-primary text-primary-foreground', icon: LuBuilding2 },
  EN_COURS_DE_TRAITEMENT: { classes: 'bg-accent text-accent-foreground', icon: LuClock },
  INCOMPLET_REJETE: { classes: 'bg-destructive text-destructive-foreground', icon: LuXCircle },
  VALIDE_ET_TRAITE: { classes: 'bg-green-600 text-white', icon: LuCheckCircle2 },
  ARCHIVE: { classes: 'bg-neutral-800 text-white', icon: LuArchive },
  EXPIRE_A_PURGER: { classes: 'bg-transparent text-destructive border-2 border-destructive', icon: LuTrash2 },
};

const DEFAULT_STYLE = { classes: 'bg-muted text-muted-foreground', icon: null };

export function getStatutStyle(statut) {
  return STATUT_STYLES[statut] || DEFAULT_STYLE;
}

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

function StatutBadge({ statut, className = '', showIcon = true }) {
  if (!statut) return null;
  const { classes, icon: Icon } = getStatutStyle(statut);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${classes} ${className}`}>
      {showIcon && Icon && <Icon size={12} />}
      {STATUT_LABELS[statut] || statut}
    </span>
  );
}

export default StatutBadge;
