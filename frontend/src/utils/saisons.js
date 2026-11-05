/**
 * Habillage saisonnier du logo — voir LogoSaisonnier.jsx.
 *
 * Une fête = une entrée dans SAISONS. Ajouter la fête des voisins ou les
 * 20 ans de l'association ne demande pas une ligne de code de plus, juste
 * une entrée et son dessin.
 *
 * Deux formes de dates :
 * - fixes : `debut` et `fin` en "MM-JJ" ; une période peut franchir le
 *   Nouvel An (Noël), le calcul en tient compte ;
 * - mobiles : `mobile: 'paques'` plus un décalage en jours. Pâques ne tombe
 *   pas à date fixe — elle se calcule, voir dimanchePaques().
 */

/**
 * Dimanche de Pâques (calendrier grégorien), par le comput de
 * Meeus/Jones/Butcher. Écrire une date en dur serait faux dès l'année
 * suivante : Pâques varie du 22 mars au 25 avril.
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

/**
 * Les fêtes retenues, dans l'ordre du calendrier. Chacune porte sa clé, qui
 * sert à la fois au dessin (voir HabillagesSaisonniers.jsx) et au libellé
 * traduit (`saisons.<cle>`).
 */
export const SAISONS = [
  { cle: 'muguet', debut: '05-01', fin: '05-01' },
  { cle: 'musique', debut: '06-21', fin: '06-21' },
  { cle: 'nationale', debut: '07-13', fin: '07-14' },
  { cle: 'halloween', debut: '10-25', fin: '11-02' },
  // Franchit le Nouvel An : traité explicitement plus bas.
  { cle: 'noel', debut: '12-15', fin: '01-02' },
  // Du Vendredi saint au Lundi de Pâques.
  { cle: 'paques', mobile: 'paques', joursAvant: 2, joursApres: 1 },
];

const aMinuit = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const decaler = (d, jours) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + jours);

/** "MM-JJ" → Date dans l'année donnée. */
function dateFixe(annee, mmjj) {
  const [mois, jour] = mmjj.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

/**
 * La saison active à la date donnée, ou null. `forcee` (réglage réservé au
 * Super Administrateur) court-circuite le calendrier pour voir un rendu hors
 * période.
 */
export function saisonActive(maintenant = new Date(), forcee = null) {
  if (forcee) return SAISONS.find((s) => s.cle === forcee) || null;

  const jour = aMinuit(maintenant);
  const annee = jour.getFullYear();

  for (const saison of SAISONS) {
    if (saison.mobile === 'paques') {
      const dimanche = dimanchePaques(annee);
      if (jour >= decaler(dimanche, -saison.joursAvant) && jour <= decaler(dimanche, saison.joursApres)) {
        return saison;
      }
      continue;
    }

    const debut = dateFixe(annee, saison.debut);
    const fin = dateFixe(annee, saison.fin);

    if (fin >= debut) {
      if (jour >= debut && jour <= fin) return saison;
      continue;
    }

    // Période à cheval sur le Nouvel An : on est dedans si on est après le
    // début (décembre) OU avant la fin (janvier).
    if (jour >= debut || jour <= fin) return saison;
  }

  return null;
}
