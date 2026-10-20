import {
  LuUserPlus, LuGraduationCap, LuUserMinus, LuFileEdit, LuThermometer, LuPalmtree,
  LuCalendarDays, LuBookOpen, LuWallet, LuMinusCircle, LuSmartphone, LuScale, LuFolder,
} from 'react-icons/lu';

/**
 * Sections du tableau de fluctuation RH, dans l'ordre du classeur Google
 * Sheets d'origine — voir backend/app/Models/FluctuationRh.php pour la
 * correspondance colonne du tableur -> champ.
 *
 * champs : colonnes affichées/saisies pour la section, dans l'ordre.
 * libelles : surcharge du libellé par défaut d'un champ (ex. date_debut =
 * "Date d'entrée" pour une entrée, "Du" pour une absence).
 * motifs : suggestions de saisie (stockées telles quelles, en français, comme
 * dans le tableur) — le champ reste libre.
 * icone : composant Lucide affiché sur la tuile de la section (vue d'ensemble).
 */
export const SECTIONS_FLUCTUATION = [
  {
    cle: 'entree', ton: 'vert', icone: LuUserPlus,
    champs: ['salarie', 'date_debut', 'date_fin', 'heures', 'observations'],
    libelles: { date_debut: 'colDateEntree', date_fin: 'colDateSortiePrevue', heures: 'colHeuresContrat' },
  },
  {
    cle: 'stagiaire', ton: 'gris', icone: LuGraduationCap,
    champs: ['salarie', 'date_debut', 'date_fin', 'observations'],
    libelles: { date_debut: 'colDateEntree', date_fin: 'colDateSortie' },
  },
  {
    cle: 'sortie', ton: 'rouge', icone: LuUserMinus,
    champs: ['salarie', 'date_debut', 'date_fin', 'motif', 'observations'],
    libelles: { date_debut: 'colDateEntree', date_fin: 'colDateSortie' },
    motifs: ['Démission', 'Rupture période d\'essai', 'Rupture conventionnelle', 'Fin de CDD', 'Licenciement', 'Licenciement pour cause réelle et sérieuse', 'Abandon de poste', 'Départ à la retraite'],
  },
  {
    cle: 'absence', ton: 'ambre', icone: LuThermometer,
    champs: ['salarie', 'date_debut', 'date_fin', 'motif', 'observations'],
    libelles: { date_debut: 'colDu', date_fin: 'colAu' },
    motifs: ['Arrêt maladie initial', 'Prolongation arrêt maladie', 'Accident de travail', 'Prolongation accident de travail', 'Absence injustifiée', 'Absence autorisée', 'Congé parental', 'Congé maternité', 'Congé paternité', 'Mi-temps thérapeutique', 'Congé événement familial'],
  },
  {
    cle: 'avenant', ton: 'bleu', icone: LuFileEdit,
    champs: ['salarie', 'date_debut', 'heures', 'observations'],
    libelles: { date_debut: 'colACompterDu', heures: 'colHeuresContrat' },
  },
  {
    cle: 'conge', ton: 'bleu', icone: LuPalmtree,
    champs: ['salarie', 'date_debut', 'date_fin', 'motif', 'observations'],
    libelles: { date_debut: 'colDu', date_fin: 'colAu' },
    motifs: ['Congés payés', 'Congés sans solde', 'Congé événement familial', 'RTT'],
    motifParDefaut: 'Congés payés',
  },
  {
    cle: 'ferie', ton: 'gris', icone: LuCalendarDays,
    champs: ['salarie', 'date_debut', 'motif', 'observations'],
    libelles: { date_debut: 'colDate', motif: 'colJourFerie' },
    motifs: ['1er janvier', 'Lundi de Pâques', '1er mai', '8 mai', 'Ascension', 'Lundi de Pentecôte', '14 juillet', '15 août', '1er novembre', '11 novembre', '25 décembre'],
  },
  {
    cle: 'acompte', ton: 'violet', icone: LuWallet,
    champs: ['salarie', 'date_debut', 'montant', 'observations'],
    libelles: { date_debut: 'colDate', observations: 'colEcheancier' },
  },
  {
    cle: 'retenue', ton: 'rouge', icone: LuMinusCircle,
    champs: ['salarie', 'date_debut', 'montant', 'observations'],
    libelles: { date_debut: 'colDate' },
  },
  {
    cle: 'formation', ton: 'vert', icone: LuBookOpen,
    champs: ['salarie', 'date_debut', 'date_fin', 'motif', 'observations'],
    libelles: { date_debut: 'colDu', date_fin: 'colAu', motif: 'colFormation' },
  },
  {
    cle: 'telephone', ton: 'gris', icone: LuSmartphone,
    champs: ['salarie', 'date_debut', 'montant', 'motif', 'observations'],
    libelles: { date_debut: 'colDate' },
    motifs: ['Perte téléphone', 'Téléphone cassé', 'Dépassement forfait téléphonique'],
  },
  {
    cle: 'discipline', ton: 'rouge', icone: LuScale,
    champs: ['salarie', 'date_debut', 'motif', 'observations'],
    libelles: { date_debut: 'colDateEffet' },
    motifs: ['Avertissement', 'Blâme', 'Mise à pied conservatoire', 'Mise à pied disciplinaire', 'Rappel à l\'ordre'],
  },
  {
    cle: 'dossier', ton: 'gris', icone: LuFolder,
    champs: ['salarie', 'date_debut', 'observations'],
    libelles: { date_debut: 'colDate', observations: 'colMiseAJour' },
  },
];

export const SECTION_PAR_CLE = Object.fromEntries(SECTIONS_FLUCTUATION.map((s) => [s.cle, s]));

/**
 * Regroupement purement visuel des 13 sections (voir FluctuationRh.jsx) —
 * toutes les sections restent affichées et cliquables comme avant, seul un
 * petit intitulé de groupe est ajouté au-dessus de chaque paquet pour que
 * l'œil s'y retrouve plus vite dans la longue liste. Aucune section n'est
 * cachée derrière un clic.
 */
export const GROUPES_FLUCTUATION = [
  { cle: 'mouvements', sections: ['entree', 'stagiaire', 'sortie', 'avenant'] },
  { cle: 'absences', sections: ['absence', 'conge', 'ferie', 'formation'] },
  { cle: 'finances', sections: ['acompte', 'retenue', 'telephone'] },
  { cle: 'dossier', sections: ['discipline', 'dossier'] },
];

/** Libellé (clé i18n sous fluctuationRh.) d'un champ pour une section donnée. */
export function cleLibelleChamp(section, champ) {
  const surcharge = SECTION_PAR_CLE[section]?.libelles?.[champ];
  if (surcharge) return surcharge;
  return {
    salarie: 'colSalarie',
    date_debut: 'colDu',
    date_fin: 'colAu',
    motif: 'colMotif',
    heures: 'colHeures',
    montant: 'colMontant',
    observations: 'colObservations',
  }[champ];
}

/** Classes Tailwind par ton de section — pastilles, onglets, tuiles. */
export const TONS = {
  vert: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/25',
  rouge: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/25',
  ambre: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
  bleu: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25',
  violet: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25',
  gris: 'bg-muted text-muted-foreground border-border',
};

export const POINT_TON = {
  vert: 'bg-green-500', rouge: 'bg-red-500', ambre: 'bg-amber-500', bleu: 'bg-blue-500', violet: 'bg-purple-500', gris: 'bg-slate-400',
};

/** Fond + couleur de l'icône sur une tuile de section (vue d'ensemble) — même palette que TONS, sans la bordure (pas une pastille). */
export const ICONE_TON = {
  vert: 'bg-green-500/10 text-green-700 dark:text-green-400',
  rouge: 'bg-red-500/10 text-red-700 dark:text-red-400',
  ambre: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bleu: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  violet: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  gris: 'bg-muted text-muted-foreground',
};

/** "2026-02" <-> Date utilitaires — le mois est toujours manipulé en "AAAA-MM" côté interface. */
export function moisCourant() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function decalerMois(mois, delta) {
  const [a, m] = mois.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function libelleMois(mois, langue = 'fr') {
  const [a, m] = mois.split('-').map(Number);
  const texte = new Date(a, m - 1, 1).toLocaleDateString(langue, { month: 'long', year: 'numeric' });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function formatDateCourte(iso) {
  if (!iso) return '';
  const [a, m, j] = String(iso).slice(0, 10).split('-');
  return `${j}/${m}/${a}`;
}

export function formatMontant(v) {
  if (v === null || v === undefined || v === '') return '';
  return Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
