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

/**
 * Analyse un nom de fichier contre la liste des salariés. Retourne une
 * suggestion — jamais une certitude :
 * - personnelId / confiance ('sur' | 'ambigu' | 'aucun')
 * - moisCle ("AAAA-MM" ou '' si rien trouvé) / moisDetecteDuNom (bool)
 */
export function analyserNomFichier(nomFichier, personnels, anneeParDefaut) {
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
        if (MOTS_IGNORES.includes(mot)) return;
        reste.push(mot);
    });

    let meilleur = null;
    let meilleurScore = 0;
    let exAequo = false;
    personnels.forEach((p) => {
        const motsNom = normaliser(p.nom || '').split(/[^a-z]+/).filter(Boolean);
        const motsPrenom = normaliser(p.prenom || '').split(/[^a-z]+/).filter(Boolean);
        let score = 0;
        reste.forEach((mot) => {
            if (motsNom.includes(mot)) score += 2;
            else if (motsPrenom.includes(mot)) score += 1;
        });
        if (score > meilleurScore) { meilleur = p; meilleurScore = score; exAequo = false; }
        else if (score > 0 && score === meilleurScore) { exAequo = true; }
    });

    if (annee === null && mois !== null) annee = anneeParDefaut;

    return {
        personnelId: meilleur ? String(meilleur.id) : '',
        confiance: !meilleur ? 'aucun' : (exAequo || meilleurScore < 2 ? 'ambigu' : 'sur'),
        moisCle: mois !== null ? cleMois(annee, mois) : '',
        moisDetecteDuNom: mois !== null,
    };
}
