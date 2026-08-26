export const getFormData = (e, callback) => {
    callback(prevData => ({
      ...prevData,
      [e.target.name]: e.target.value
    }));
  };

/**
 * Référence auto-générée pour un document archivé en lot (plusieurs fichiers
 * à la fois — voir ArchiverDocumentModal.jsx et OpenFolder.jsx). `index`
 * garantit l'unicité même si deux fichiers du même lot sont traités dans la
 * même milliseconde. Volontairement SANS suffixe purement numérique en fin
 * de chaîne : DocView.jsx regroupe automatiquement en "pages du même dépôt"
 * tout document dont la référence se termine par "-<1 à 3 chiffres>" et
 * partage le même préfixe — ces documents sont distincts, pas des pages
 * d'un même dépôt, donc ce regroupement ne doit surtout pas se déclencher ici.
 */
export const genererReferenceAuto = (codeCategorie, index) => {
  const suffixe = (Date.now().toString(36) + index.toString(36)).toUpperCase();
  return `${codeCategorie || 'DOC'}-${suffixe}`;
};

/**
 * Le nom affiché doit venir de la fiche Personnel (nom/prénom, modifiable dans le profil)
 * plutôt que du champ `nom` du compte de connexion (Utilisateurs), qui n'est qu'un
 * identifiant technique jamais mis à jour par l'utilisateur.
 */
export const getDisplayName = (user) => {
  const personnel = user?.personnel;
  if (personnel?.nom || personnel?.prenom) {
    return `${personnel.prenom || ''} ${personnel.nom || ''}`.trim();
  }
  return user?.nom || '';
};

export const getInitials = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
};

/**
 * Classe d'animation pour le niveau d'alerte d'un suivi de délai (voir
 * SuiviDelai/EtapeWorkflow côté backend) : plus le retard est grave, plus le
 * mouvement est marqué — rouge bouge nettement plus vite/fort que orange, vert
 * (ou pas de suivi actif) reste immobile.
 */
export const alerteDelaiClass = (niveauAlerte) => {
  if (niveauAlerte === 'ROUGE') return 'animate-alerte-rouge ring-2 ring-destructive';
  if (niveauAlerte === 'ORANGE') return 'animate-alerte-orange ring-1 ring-accent';
  return '';
};

/**
 * Bordure gauche discrète selon le statut du document (voir StatutBadge pour
 * la même palette de couleurs) — un repère visuel immédiat en un coup d'œil
 * sur une carte/ligne de document, sans avoir besoin d'un gros bandeau.
 *
 * `externe` (compte intervenant/bénéficiaire) : ARCHIVE prend la couleur de
 * VALIDE_ET_TRAITE — de son point de vue les deux veulent dire "traité", pas
 * la peine qu'une teinte différente laisse deviner une distinction interne.
 */
export const bordureStatutClass = (statut, externe = false) => {
  if (externe && statut === 'ARCHIVE') statut = 'VALIDE_ET_TRAITE';
  switch (statut) {
    case 'SOUMIS': return 'border-l-4 border-l-secondary';
    case 'TRANSMIS_AU_SERVICE': return 'border-l-4 border-l-primary';
    case 'EN_COURS_DE_TRAITEMENT': return 'border-l-4 border-l-accent';
    case 'INCOMPLET_REJETE': return 'border-l-4 border-l-destructive animate-scintille-rejet';
    case 'VALIDE_ET_TRAITE': return 'border-l-4 border-l-green-600';
    case 'ARCHIVE': return 'border-l-4 border-l-neutral-800';
    case 'EXPIRE_A_PURGER': return 'border-l-4 border-l-destructive border-dashed';
    default: return 'border-l-4 border-l-transparent';
  }
};

/**
 * État du délai de correction (3 jours) d'un document rejeté — voir
 * DocumentStatusService côté backend, qui pose `date_limite_correction` au
 * moment du rejet. `null` si le document n'a pas (ou plus) de délai actif.
 */
export const infoDelaiCorrection = (document) => {
  if (!document?.date_limite_correction) return null;
  const echeance = new Date(document.date_limite_correction).getTime();
  const diffMs = echeance - Date.now();
  const enRetard = diffMs < 0;
  const diffAbsMs = Math.abs(diffMs);
  const jours = Math.floor(diffAbsMs / 86400000);
  const heures = Math.floor((diffAbsMs % 86400000) / 3600000);
  return {
    enRetard,
    jours,
    heures,
    texte: enRetard ? `En retard de ${jours}j ${heures}h` : `${jours}j ${heures}h restants avant renvoi`,
  };
};

/**
 * Comme bordureStatutClass, mais fait basculer la bordure en noir (fixe, plus
 * de scintillement) une fois le délai de correction de 3 jours dépassé — le
 * document reste "à traiter" mais différemment, ça n'a plus de sens de le
 * signaler avec la même urgence qu'un rejet tout frais.
 */
export const bordureDocumentClass = (document, externe = false) => {
  const delai = infoDelaiCorrection(document);
  if (document?.status_doc === 'INCOMPLET_REJETE' && delai?.enRetard) {
    return 'border-l-4 border-l-neutral-800';
  }
  return bordureStatutClass(document?.status_doc, externe);
};

/**
 * Part du temps restant avant l'échéance d'un suivi de délai actif, de 1
 * (tout juste démarré) à 0 (échéance atteinte) — calculée depuis les vraies
 * dates (etape_demarree_le / echeance_le), pas une estimation fixe. Sert à
 * la barre de délai qui se vide en haut d'une carte de document.
 */
export const pourcentageTempsRestant = (suiviDelaiActif) => {
  if (!suiviDelaiActif?.etape_demarree_le || !suiviDelaiActif?.echeance_le) return null;
  const debut = new Date(suiviDelaiActif.etape_demarree_le).getTime();
  const echeance = new Date(suiviDelaiActif.echeance_le).getTime();
  if (echeance <= debut) return 0;
  const ratio = (echeance - Date.now()) / (echeance - debut);
  return Math.max(0, Math.min(1, ratio));
};

/**
 * Couleur de la barre de délai, cohérente avec le niveau d'alerte déjà
 * calculé côté backend (voir NiveauAlerte) plutôt que de recalculer un seuil
 * en double côté front.
 */
export const couleurUrgence = (niveauAlerte) => {
  if (niveauAlerte === 'ROUGE') return 'bg-destructive animate-scintille-rejet';
  if (niveauAlerte === 'ORANGE') return 'bg-accent';
  return 'bg-green-600';
};

export const alerteDelaiLabel = (suiviDelaiActif) => {
  if (!suiviDelaiActif) return null;
  const etape = suiviDelaiActif.etape_workflow;
  const echeance = new Date(suiviDelaiActif.echeance_le);
  if (suiviDelaiActif.niveau_alerte === 'ROUGE') {
    return `Délai dépassé — ${etape?.nom || 'étape en cours'}`;
  }
  if (suiviDelaiActif.niveau_alerte === 'ORANGE') {
    return `Échéance proche (${echeance.toLocaleDateString('fr-FR')}) — ${etape?.nom || 'étape en cours'}`;
  }
  return `${etape?.nom || 'Étape en cours'} — échéance le ${echeance.toLocaleDateString('fr-FR')}`;
};