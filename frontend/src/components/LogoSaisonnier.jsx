import React, { useEffect, useState } from 'react';
import { getHabillageSaisonnier } from '../api/routes/parametre';
import { saisonActive } from '../utils/saisons';
import { HABILLAGES } from './HabillagesSaisonniers';

/**
 * Habillage saisonnier posé PAR-DESSUS le logo, jamais à sa place — voir
 * utils/saisons.js pour le calendrier et HabillagesSaisonniers.jsx pour les
 * dessins. Le logo officiel reste donc intact : couper le réglage suffit à
 * tout retirer, et rien ne touche aux PDF, courriers ou e-mails, qui
 * continuent de porter la marque telle quelle.
 *
 * Le réglage est lu une fois par chargement de page et mis en cache sur le
 * module : ce composant est monté dans le menu, affiché en permanence, il
 * ne doit pas interroger le serveur à chaque navigation.
 */

let reglageEnCache = null;
let demandeEnCours = null;

function chargerReglage() {
  if (reglageEnCache) return Promise.resolve(reglageEnCache);
  if (demandeEnCours) return demandeEnCours;

  demandeEnCours = getHabillageSaisonnier()
    .then(async (res) => (res.status === 200 ? res.json() : null))
    .then((valeur) => {
      reglageEnCache = valeur || { actif: false, forcer: null };
      return reglageEnCache;
    })
    .catch(() => {
      // Un habillage est un ornement : s'il échoue, le logo reste nu, sans
      // le moindre message à l'utilisateur.
      reglageEnCache = { actif: false, forcer: null };
      return reglageEnCache;
    })
    .finally(() => { demandeEnCours = null; });

  return demandeEnCours;
}

/** À appeler après un changement du réglage pour le relire au prochain rendu. */
export function oublierHabillageEnCache() {
  reglageEnCache = null;
}

function LogoSaisonnier() {
  const [saison, setSaison] = useState(null);

  useEffect(() => {
    let annule = false;
    chargerReglage().then((reglage) => {
      if (annule || !reglage?.actif) return;
      setSaison(saisonActive(new Date(), reglage.forcer));
    });
    return () => { annule = true; };
  }, []);

  if (!saison) return null;
  const Habillage = HABILLAGES[saison.cle];
  if (!Habillage) return null;

  return <Habillage />;
}

export default LogoSaisonnier;
