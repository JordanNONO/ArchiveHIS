import * as XLSX from 'xlsx';
import { SECTION_PAR_CLE } from '../constants/fluctuationRh';

/**
 * Lecture du classeur Google Sheets "FLUCTUATION" (Fichier > Télécharger >
 * .xlsx) : un onglet par mois ("JANVIER 2025", "MARS", "JUILLET "...), et
 * dans chaque onglet des sections empilées (ENTREES, SORTIES, ABSENCES...),
 * chacune suivie d'une ligne d'en-tête "N° | NOMS & PRENOMS | ..." puis de
 * ses lignes.
 *
 * Tout le découpage se fait ici, dans le navigateur : le backend ne reçoit que
 * des lignes déjà structurées (voir FluctuationRhController::importer()), ce
 * qui permet d'afficher un aperçu avant d'écrire quoi que ce soit en base.
 * Rien n'est jeté : une cellule qu'on ne sait pas interpréter (date
 * illisible, colonne en trop) part dans "observations".
 */

const MOIS = ['JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN', 'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE'];

const TITRES_SECTIONS = [
  [/^ENTREE/, 'entree'],
  [/^STAGIAIRE/, 'stagiaire'],
  [/^SORTIE/, 'sortie'],
  [/^ABSENCE/, 'absence'],
  [/^AVENANT/, 'avenant'],
  [/^CONGE/, 'conge'],
  [/FERIE/, 'ferie'],
  [/^(AVANCE|ACOMPTE)/, 'acompte'],
  [/^(RETENTION|RETENU|RETRAIT)/, 'retenue'],
  [/^FORMATION/, 'formation'],
  [/TELEPHON/, 'telephone'],
  [/^MESURES? DISCIPLINAIRE/, 'discipline'],
  [/^MISE A JOUR/, 'dossier'],
];

function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

function texte(cellule) {
  if (cellule === null || cellule === undefined) return '';
  if (cellule instanceof Date) return dateIso(cellule) || '';
  return String(cellule).replace(/\r/g, '').trim();
}

function dateIso(d) {
  // Les dates SheetJS tombent parfois quelques minutes avant minuit (fuseau) :
  // on recentre sur midi avant de lire jour/mois/année.
  const recentree = new Date(d.getTime() + 12 * 3600 * 1000);
  if (Number.isNaN(recentree.getTime())) return null;
  const a = recentree.getFullYear();
  if (a < 1950 || a > 2100) return null;
  return `${a}-${String(recentree.getMonth() + 1).padStart(2, '0')}-${String(recentree.getDate()).padStart(2, '0')}`;
}

/**
 * Un jour saisi à la main peut ne pas exister ("31/04", "30/02" — avril n'a
 * que 30 jours, février au plus 29) : le serveur rejette alors la ligne
 * entière (validation Laravel 'date', voir FluctuationRhController), alors
 * que lireDate() doit la traiter comme illisible (-> observations, voir
 * dateOuReste() plus bas) pour ne vraiment rien perdre.
 */
function jourExisteVraiment(j, mo, a) {
  const d = new Date(a, mo - 1, j);
  return d.getFullYear() === a && d.getMonth() === mo - 1 && d.getDate() === j;
}

/** "09/02/2026", "5/2/2026", "DU 28/08/2025", "16/02/26", objet Date -> "AAAA-MM-JJ" (ou null). */
export function lireDate(cellule) {
  if (cellule instanceof Date) return dateIso(cellule);
  const m = texte(cellule).match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*[/.-]\s*(\d{2,4})/);
  if (!m) return null;
  let [, j, mo, a] = m.map(Number);
  if (a < 100) a += 2000;
  if (mo < 1 || mo > 12 || j < 1 || j > 31) return null;
  if (!jourExisteVraiment(j, mo, a)) return null;
  return `${a}-${String(mo).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
}

/** "1000 EUROS", "700 €", "1 250,50" -> nombre (ou null). */
export function lireMontant(cellule) {
  if (typeof cellule === 'number') return cellule;
  const m = texte(cellule).replace(/\s/g, '').match(/\d+(?:[.,]\d{1,2})?/);
  return m ? Number(m[0].replace(',', '.')) : null;
}

/**
 * "FEVRIER 2026" -> "2026-02". Les onglets sans année ("MARS", "JUILLET ")
 * prennent celle de l'onglet précédent (+1 si on repasse par janvier).
 */
export function lireMoisOnglet(nom, precedent) {
  const n = normaliser(nom);
  const index = MOIS.findIndex((m) => n.startsWith(m));
  if (index === -1) return null;
  const annee = n.match(/(20\d{2})/);
  let a;
  if (annee) {
    a = Number(annee[1]);
  } else if (precedent) {
    const [ap, mp] = precedent.split('-').map(Number);
    a = index + 1 <= mp ? ap + 1 : ap;
  } else {
    a = new Date().getFullYear();
  }
  return `${a}-${String(index + 1).padStart(2, '0')}`;
}

/**
 * Ligne de titre = texte en colonne A, rien en colonne B. Renvoie la clé de
 * section, 'inconnue' pour un titre qu'on ne sait pas classer (ses lignes
 * sont alors ignorées et le titre signalé dans l'aperçu, plutôt que
 * rattachées à tort à la section précédente), ou null si ce n'est pas un titre.
 */
function titreSection(cellules) {
  const premiere = normaliser(cellules[0]);
  if (!premiere || /^\d/.test(premiere) || texte(cellules[1]) || premiere.startsWith('N°') || premiere === 'N') return null;
  const trouve = TITRES_SECTIONS.find(([motif]) => motif.test(premiere));
  return trouve ? trouve[1] : 'inconnue';
}

function estEnTete(cellules) {
  return normaliser(cellules[0]).startsWith('N°') || normaliser(cellules[0]) === 'N' || /^NOMS?\b/.test(normaliser(cellules[1]));
}

/** Motif sur plusieurs lignes dans le tableur : 1re ligne = motif, le reste en observation. */
function decouperMotif(brut) {
  const lignes = texte(brut).split('\n').map((l) => l.trim()).filter(Boolean);
  return { motif: lignes[0] || '', suite: lignes.slice(1).join(' ') };
}

/**
 * Motif du tableur ("DEMISSION", "CONGES PAYES") -> libellé de la liste de
 * l'appli ("Démission", "Congés payés") quand ils ne diffèrent que par la
 * casse, les accents ou la ponctuation ; sinon le texte d'origine, en
 * minuscules avec majuscule initiale.
 */
function motifNormalise(section, brut) {
  if (!brut) return null;
  const sansPonctuation = (x) => normaliser(x).replace(/[^A-Z0-9]/g, '');
  const cible = sansPonctuation(brut);
  const connu = (SECTION_PAR_CLE[section]?.motifs || []).find((m) => sansPonctuation(m) === cible);
  return connu || brut.charAt(0).toUpperCase() + brut.slice(1).toLowerCase();
}

function joindre(...morceaux) {
  return morceaux.map((m) => texte(m)).filter(Boolean).join(' — ') || null;
}

/** Date lue, ou texte brut renvoyé en observation si la cellule n'est pas une date reconnaissable. */
function dateOuReste(cellule, restes) {
  const d = lireDate(cellule);
  if (!d && texte(cellule)) restes.push(texte(cellule));
  return d;
}

/**
 * Colonne "heures" censée ne contenir qu'une courte mention ("35h", "mi-temps")
 * — limitée à 50 caractères côté serveur (voir FluctuationRhController). Une
 * cellule plus longue n'est manifestement pas ça (texte libre mal placé dans
 * la mauvaise colonne) : part en observation plutôt que tronquée (on ne
 * perd rien) ou envoyée telle quelle (le serveur la rejetterait).
 */
function heureOuReste(cellule, restes) {
  const h = texte(cellule).replace(/\s*H$/i, ' h').trim();
  if (!h) return null;
  if (h.length > 50) { restes.push(h); return null; }
  return h;
}

function ligneDepuisCellules(section, c, offset = 0) {
  const v = (i) => c[offset + i];
  const salarie = texte(v(1)).replace(/\s+/g, ' ');
  if (!salarie) return null;
  const restes = [];
  const extra = c.slice(offset + 5).map(texte).filter(Boolean);
  const ligne = { section, salarie, date_debut: null, date_fin: null, motif: null, heures: null, montant: null, observations: null };

  switch (section) {
    case 'entree':
      ligne.date_debut = dateOuReste(v(2), restes);
      ligne.date_fin = dateOuReste(v(3), restes);
      ligne.heures = heureOuReste(v(4), restes);
      break;
    case 'avenant':
      ligne.date_debut = dateOuReste(v(2), restes);
      if (texte(v(3))) restes.push(texte(v(3)));
      ligne.heures = heureOuReste(v(4), restes);
      break;
    case 'ferie':
    case 'discipline':
      ligne.date_debut = dateOuReste(v(2), restes);
      if (texte(v(3))) restes.push(texte(v(3)));
      ligne.motif = motifNormalise(section, texte(v(4)));
      break;
    case 'telephone':
      ligne.date_debut = dateOuReste(v(2), restes);
      ligne.montant = lireMontant(v(3));
      if (ligne.montant === null && texte(v(3))) restes.push(texte(v(3)));
      ligne.motif = motifNormalise(section, texte(v(4)));
      break;
    case 'dossier':
      ligne.date_debut = dateOuReste(v(2), restes);
      restes.push(texte(v(3)), texte(v(4)));
      break;
    case 'stagiaire':
      ligne.date_debut = dateOuReste(v(2), restes);
      ligne.date_fin = dateOuReste(v(3), restes);
      restes.push(texte(v(4)));
      break;
    case 'acompte':
    case 'retenue':
      ligne.date_debut = dateOuReste(v(2), restes);
      ligne.montant = lireMontant(v(3));
      if (ligne.montant === null && texte(v(3))) restes.push(texte(v(3)));
      restes.push(texte(v(4)).replace(/\n+/g, ' '));
      break;
    default: {
      // sortie, absence, conge, formation : période + motif
      ligne.date_debut = dateOuReste(v(2), restes);
      ligne.date_fin = dateOuReste(v(3), restes);
      const { motif, suite } = decouperMotif(v(4));
      ligne.motif = motifNormalise(section, motif);
      restes.push(suite);
    }
  }

  // Bloc acompte saisi à droite d'un autre sur la même ligne du tableur
  // (vu en février 2026) : il est rendu comme une ligne à part, pas noyé dans
  // les observations de la première.
  const blocVoisin = (section === 'acompte' || section === 'retenue') && offset === 0 && texte(c[6]);
  if (!blocVoisin) restes.push(...extra);

  ligne.observations = joindre(...restes);
  if (ligne.motif && ligne.motif.length > 255) {
    ligne.observations = joindre(ligne.motif, ligne.observations);
    ligne.motif = ligne.motif.slice(0, 250) + '…';
  }
  return ligne;
}

/** Une feuille (déjà en tableau de lignes) -> { lignes, titresInconnus }. */
export function lireFeuille(lignesBrutes) {
  const lignes = [];
  const titresInconnus = [];
  let section = null;
  for (const brute of lignesBrutes) {
    const c = Array.isArray(brute) ? brute : [];
    if (!c.some((x) => texte(x))) continue;
    const titre = titreSection(c);
    if (titre) {
      section = titre;
      if (titre === 'inconnue') titresInconnus.push(texte(c[0]));
      continue;
    }
    if (!section || section === 'inconnue' || estEnTete(c)) continue;
    const ligne = ligneDepuisCellules(section, c);
    if (ligne) lignes.push(ligne);
    if ((section === 'acompte' || section === 'retenue') && texte(c[6])) {
      const voisine = ligneDepuisCellules(section, c, 5);
      if (voisine) lignes.push(voisine);
    }
  }
  return { lignes, titresInconnus };
}

/**
 * Fichier .xlsx (tous les onglets-mois) ou .csv (un seul mois, à choisir dans
 * l'aperçu) -> [{ onglet, mois, lignes, titresInconnus }].
 */
export async function lireClasseurFluctuation(fichier) {
  const donnees = await fichier.arrayBuffer();
  // raw: true — sans lui, SheetJS convertit lui-même le texte d'un CSV
  // ("02/03/2026") en date au format américain (mois/jour), soit le 3 février.
  // On garde le texte tel quel : lireDate() le lit jour/mois. Sans effet sur
  // les vraies cellules date d'un .xlsx, déjà non ambiguës.
  const classeur = XLSX.read(donnees, { type: 'array', cellDates: true, raw: true });
  const resultat = [];
  let precedent = null;
  for (const nom of classeur.SheetNames) {
    const feuille = classeur.Sheets[nom];
    const lignes = XLSX.utils.sheet_to_json(feuille, { header: 1, raw: true, defval: '' });
    const mois = lireMoisOnglet(nom, precedent);
    if (mois) precedent = mois;
    resultat.push({ onglet: nom, mois, ...lireFeuille(lignes) });
  }
  return resultat;
}
