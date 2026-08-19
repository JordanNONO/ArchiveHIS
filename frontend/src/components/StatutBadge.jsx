import React from 'react';
import { LuSend, LuBuilding2, LuClock, LuXCircle, LuCheckCircle2, LuArchive, LuTrash2 } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

// Valeurs = clés de traduction (namespace "statuts"), pas le texte affiché —
// toujours passer par t(STATUT_LABELS[x]) au rendu (voir StatutBadge
// ci-dessous et DocView.jsx, historique/menu de changement de statut).
export const STATUT_LABELS = {
  SOUMIS: 'statuts.soumis',
  TRANSMIS_AU_SERVICE: 'statuts.transmisAuService',
  EN_COURS_DE_TRAITEMENT: 'statuts.enCoursDeTraitement',
  INCOMPLET_REJETE: 'statuts.incompletRejete',
  VALIDE_ET_TRAITE: 'statuts.valideEtTraite',
  ARCHIVE: 'statuts.archive',
  EXPIRE_A_PURGER: 'statuts.expireAPurger',
};

/**
 * Libellés simplifiés pour un compte externe (intervenant, bénéficiaire) :
 * le circuit de validation interne (soumis → transmis → en cours → validé →
 * archivé) ne le concerne pas, seul "où en est mon dossier" compte — pas
 * besoin qu'il sache si sa pièce a été "archivée" ou "validée", les deux
 * veulent dire la même chose de son point de vue : c'est traité.
 */
export const STATUT_LABELS_EXTERNE = {
  SOUMIS: 'statuts.recu',
  TRANSMIS_AU_SERVICE: 'statuts.enCoursDeTraitement',
  EN_COURS_DE_TRAITEMENT: 'statuts.enCoursDeTraitement',
  INCOMPLET_REJETE: 'statuts.aCompleter',
  VALIDE_ET_TRAITE: 'statuts.traite',
  ARCHIVE: 'statuts.traite',
  EXPIRE_A_PURGER: 'statuts.traite',
};

/** Pour un usage hors composant React (ex: tri/recherche) — voir t(STATUT_LABELS[x]) sinon. */
export function libelleStatut(statut, externe = false) {
  const cle = externe ? (STATUT_LABELS_EXTERNE[statut] || STATUT_LABELS[statut]) : STATUT_LABELS[statut];
  return cle ? i18n.t(cle) : statut;
}

/**
 * Chaque statut a une couleur et une icône qui lui sont propres (pas de doublon),
 * avec une sémantique cohérente : bleu = en transit, or = en cours/attention,
 * vert = succès, rouge = problème, noir = classé, rouge cerclé = fin de vie.
 */
const STATUT_STYLES = {
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
  SOUMIS: ['TRANSMIS_AU_SERVICE', 'INCOMPLET_REJETE', 'VALIDE_ET_TRAITE'],
  TRANSMIS_AU_SERVICE: ['EN_COURS_DE_TRAITEMENT', 'VALIDE_ET_TRAITE', 'INCOMPLET_REJETE'],
  EN_COURS_DE_TRAITEMENT: ['VALIDE_ET_TRAITE', 'INCOMPLET_REJETE'],
  INCOMPLET_REJETE: ['SOUMIS'],
  VALIDE_ET_TRAITE: ['ARCHIVE'],
  ARCHIVE: ['EXPIRE_A_PURGER'],
  EXPIRE_A_PURGER: [],
};

function StatutBadge({ statut, className = '', showIcon = true, externe = false }) {
  const { t } = useTranslation();
  if (!statut) return null;
  // Vu de l'extérieur, "Validé et traité" et "Archivé" affichent la même
  // couleur (celle de "Traité") — sinon deux teintes différentes pour un
  // libellé identique donnerait l'impression d'un statut caché en plus.
  const statutVisuel = externe && statut === 'ARCHIVE' ? 'VALIDE_ET_TRAITE' : statut;
  const { classes, icon: Icon } = getStatutStyle(statutVisuel);
  const cleLibelle = externe ? (STATUT_LABELS_EXTERNE[statut] || STATUT_LABELS[statut]) : STATUT_LABELS[statut];
  const libelle = cleLibelle ? t(cleLibelle) : statut;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${classes} ${className}`}>
      {showIcon && Icon && <Icon size={12} />}
      {libelle}
    </span>
  );
}

export default StatutBadge;
