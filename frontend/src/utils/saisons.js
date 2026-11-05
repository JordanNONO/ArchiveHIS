/**
 * Calendrier de l'habillage saisonnier du logo — voir BadgeSaisonnier.jsx
 * pour les décors et HabillageSaisonnier.jsx pour la page de réglage.
 *
 * Une fête = une entrée dans PERIODES : sa clé, et une fonction qui rend
 * [début, fin] pour une année donnée. La forme fonction plutôt qu'un couple
 * de dates fixes est indispensable : Pâques, Mardi gras et le Nouvel An ne
 * tombent pas aux mêmes dates d'une année sur l'autre.
 */

/**
 * Dimanche de Pâques (calendrier grégorien), comput de Meeus/Jones/Butcher.
 * Pâques varie du 22 mars au 25 avril : une date écrite en dur serait fausse
 * dès l'année suivante. Mardi gras s'en déduit (47 jours avant).
 */
export function dimanchePaques(annee) {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(annee, mois - 1, jour);
}

const jourDe = (annee, mois, jour) => new Date(annee, mois - 1, jour);
const decaler = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

/** Ordre du calendrier, du 1er janvier au 31 décembre. */
export const ORDRE_SAISONS = [
  'nouvelan', 'epiphanie', 'chandeleur', 'valentin', 'carnaval', 'paques',
  'avril', 'mai', 'musique', 'juillet', 'halloween', 'noel',
];

export const PERIODES = {
  nouvelan: (y) => [jourDe(y, 12, 30), jourDe(y + 1, 1, 2)],
  epiphanie: (y) => [jourDe(y, 1, 4), jourDe(y, 1, 8)],
  chandeleur: (y) => [jourDe(y, 2, 1), jourDe(y, 2, 3)],
  valentin: (y) => [jourDe(y, 2, 12), jourDe(y, 2, 14)],
  // Mardi gras : 47 jours avant Pâques, donc mobile lui aussi.
  carnaval: (y) => { const p = dimanchePaques(y); return [decaler(p, -51), decaler(p, -47)]; },
  paques: (y) => { const p = dimanchePaques(y); return [decaler(p, -7), decaler(p, 1)]; },
  avril: (y) => [jourDe(y, 4, 1), jourDe(y, 4, 1)],
  mai: (y) => [jourDe(y, 4, 30), jourDe(y, 5, 2)],
  musique: (y) => [jourDe(y, 6, 20), jourDe(y, 6, 22)],
  juillet: (y) => [jourDe(y, 7, 13), jourDe(y, 7, 15)],
  halloween: (y) => [jourDe(y, 10, 24), jourDe(y, 10, 31)],
  noel: (y) => [jourDe(y, 12, 1), jourDe(y, 12, 26)],
};

const aMinuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Prochaine occurrence d'une fête : { debut, fin, enCours, jours }.
 * On balaie l'année précédente, l'année courante et la suivante, et on garde
 * la première période pas encore terminée — c'est ce qui permet au Nouvel An,
 * à cheval sur deux années, de rester correct le 1er janvier.
 */
export function etatSaison(cle, maintenant = new Date()) {
  const jour = aMinuit(maintenant);

  for (const annee of [jour.getFullYear() - 1, jour.getFullYear(), jour.getFullYear() + 1]) {
    const [debut, fin] = PERIODES[cle](annee);
    if (jour <= fin) {
      return {
        debut,
        fin,
        enCours: jour >= debut,
        jours: Math.round((debut - jour) / 86400000),
      };
    }
  }

  return null;
}

/**
 * La fête à afficher aujourd'hui, ou null. `forcee` (réglage réservé au
 * Super Administrateur) court-circuite le calendrier pour voir un décor hors
 * de sa période.
 */
export function saisonActive(maintenant = new Date(), forcee = null) {
  if (forcee) return ORDRE_SAISONS.includes(forcee) ? forcee : null;

  return ORDRE_SAISONS.find((cle) => etatSaison(cle, maintenant)?.enCours) || null;
}
