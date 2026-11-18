/**
 * Lecture du salarié et du mois dans un nom de fichier de bulletin de paie —
 * une SUGGESTION affichée et modifiable sur chaque ligne de l'onglet Dépôt,
 * jamais appliquée sans que l'administrateur la voie (même principe que
 * l'ancien suggererPersonnel() qu'elle remplace). Reconnaît par exemple
 * "NOM Prenom - Mois Annee", "bp_nom_prenom_moisAbrege_annee",
 * "NOM Prenom MM-AAAA" ou "moisannee" collé, avec ou sans accents.
 */

const MOIS_LABELS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MOIS_NORMALISES = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
const ABREVIATIONS_MOIS = { jan: 0, janv: 0, fev: 1, fevr: 1, avr: 3, juil: 6, aou: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const MOTS_IGNORES = ['bulletin', 'bulletins', 'paie', 'de', 'du', 'des', 'la', 'le', 'bp', 'salaire', 'fiche', 'mois', 'scan', 'copie', 'pdf', 'final', 'v'];

/** Clé stable "AAAA-MM" pour une année + un index de mois (0 = janvier). */
export function cleMois(annee, moisIndex) {
    return `${annee}-${String(moisIndex + 1).padStart(2, '0')}`;
}

/** Clé "AAAA-MM" du mois courant. */
export function cleMoisCourant() {
    const d = new Date();
    return cleMois(d.getFullYear(), d.getMonth());
}

/** Décale une clé "AAAA-MM" de `delta` mois (peut être négatif). */
export function decalerCle(cle, delta) {
    const annee = Number(cle.slice(0, 4));
    const moisIndex = Number(cle.slice(5)) - 1;
    const d = new Date(annee, moisIndex + delta, 1);
    return cleMois(d.getFullYear(), d.getMonth());
}

/** Libellé lisible d'une clé "AAAA-MM", ex. "Novembre 2026". */
export function libelleMois(cle) {
    const moisIndex = Number(cle.slice(5)) - 1;
    return `${MOIS_LABELS[moisIndex]} ${cle.slice(0, 4)}`;
}

/** Libellé court, pour une colonne étroite (grille de suivi), ex. "Nov. 26". */
export function libelleMoisCourt(cle) {
    const moisIndex = Number(cle.slice(5)) - 1;
    return `${MOIS_LABELS[moisIndex].slice(0, 3)}. ${cle.slice(2, 4)}`;
}

/** Libellé en minuscules pour une phrase, ex. "septembre 2026". */
export function libelleMoisMinuscule(cle) {
    return libelleMois(cle).toLowerCase();
}

/** Texte comparable : sans accents, en minuscules. */
export function normaliser(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function indexMois(mot) {
    const i = MOIS_NORMALISES.indexOf(mot);
    if (i >= 0) return i;
    return Object.prototype.hasOwnProperty.call(ABREVIATIONS_MOIS, mot) ? ABREVIATIONS_MOIS[mot] : null;
}

/** Mots d'un nom de personne, sans accents ni ponctuation ("Laurence-Marie" → laurence, marie). */
export function motsDuNom(texte) {
    return normaliser(texte).split(/[^a-z]+/).filter((m) => m.length > 1);
}

/** Clé indépendante de l'ordre des mots — même principe que SalariesPaie::cle() côté serveur. */
export function cleDuNom(texte) {
    return normaliser(texte).split(/[^a-z]+/).filter(Boolean).sort().join(' ').toUpperCase();
}

function estMotDeService(mot) {
    return !mot || /\d/.test(mot) || indexMois(mot) !== null || MOTS_IGNORES.includes(mot);
}

/**
 * Le nom de la personne tel qu'écrit dans le fichier, pour créer son dossier
 * quand elle n'est connue nulle part : "SAMBA VOUALA ALDA CARINE - Septembre
 * 2026.pdf" → "SAMBA VOUALA ALDA CARINE".
 */
export function nomDepuisFichier(nomFichier) {
    const base = nomFichier.replace(/\.pdf$/i, '').split(/\s+-\s+/)[0];
    return base
        .replace(/[_]+/g, ' ')
        .split(/\s+/)
        .filter((morceau) => !estMotDeService(normaliser(morceau).replace(/[^a-z0-9]/g, '')))
        .join(' ')
        .trim();
}

/**
 * Analyse un nom de fichier contre la liste des salariés ({ cle, nom }).
 * Règle stricte — un bulletin de paie rangé chez la mauvaise personne est la
 * pire erreur possible :
 * - 'sur' : TOUS les mots du nom du salarié sont dans le fichier, et le
 *   fichier ne contient aucun autre mot de nom → attribué d'office ;
 * - 'ambigu' : un nom complet retrouvé, mais avec des mots en plus ou en
 *   moins (deuxième prénom…) → attribué, à confirmer ;
 * - 'aucun' : seulement une partie du nom (le nom de famille seul : deux
 *   AWASSI différents ne sont jamais confondus), ou plusieurs salariés
 *   possibles → rien n'est attribué, des suggestions sont proposées.
 */
export function analyserNomFichier(nomFichier, salaries, anneeParDefaut) {
    let s = normaliser(nomFichier).replace(/\.pdf$/, '');
    s = s.replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2');

    let mois = null;
    let annee = null;
    let r = s.match(/(20\d{2})[-_. ]?(0[1-9]|1[0-2])(?!\d)/);
    if (r) { annee = +r[1]; mois = +r[2] - 1; }
    if (mois === null) {
        r = s.match(/(?:^|\D)(0?[1-9]|1[0-2])[-_. /](20\d{2})/);
        if (r) { mois = +r[1] - 1; annee = +r[2]; }
    }

    const reste = [];
    s.split(/[^a-z0-9]+/).filter(Boolean).forEach((mot) => {
        if (/^20\d{2}$/.test(mot)) { if (annee === null) annee = +mot; return; }
        if (/^\d+$/.test(mot)) return;
        const mi = indexMois(mot);
        if (mi !== null) { if (mois === null) mois = mi; return; }
        if (MOTS_IGNORES.includes(mot) || mot.length < 2) return;
        reste.push(mot);
    });

    const motsFichier = new Set(reste);
    const candidats = [];
    salaries.forEach((s) => {
        const motsSalarie = motsDuNom(s.nom);
        if (!motsSalarie.length) return;
        const duSalarieDansFichier = motsSalarie.filter((m) => motsFichier.has(m)).length;
        if (!duSalarieDansFichier) return;
        const motsSalarieSet = new Set(motsSalarie);
        const duFichierDansSalarie = reste.filter((m) => motsSalarieSet.has(m)).length;
        const nomComplet = duSalarieDansFichier === motsSalarie.length;
        const rienDePlus = duFichierDansSalarie === reste.length;
        let score = 1;
        if (nomComplet && rienDePlus) score = 3;
        else if (nomComplet || (rienDePlus && reste.length >= 2)) score = 2;
        candidats.push({ cle: s.cle, score, communs: duSalarieDansFichier });
    });
    candidats.sort((a, b) => (b.score - a.score) || (b.communs - a.communs));

    const meilleurScore = candidats[0]?.score || 0;
    const ex = candidats.filter((c) => c.score === meilleurScore);
    let cle = '';
    let confiance = 'aucun';
    if (ex.length === 1 && meilleurScore === 3) { cle = ex[0].cle; confiance = 'sur'; }
    else if (ex.length === 1 && meilleurScore === 2) { cle = ex[0].cle; confiance = 'ambigu'; }

    if (annee === null && mois !== null) annee = anneeParDefaut;

    return {
        cle,
        confiance,
        candidats: candidats.slice(0, 8).map((c) => c.cle),
        nomDuFichier: nomDepuisFichier(nomFichier),
        moisCle: mois !== null ? cleMois(annee, mois) : '',
        moisDetecteDuNom: mois !== null,
    };
}
