import React, { useEffect, useState } from 'react';
import { getHabillageSaisonnier } from '../api/routes/parametre';
import { saisonActive } from '../utils/saisons';
import BadgeSaisonnier from './saison/BadgeSaisonnier';

/**
 * Habillage saisonnier posé par-dessus le logo partout où il s'affiche :
 * menu, page de connexion, partage externe. Le logo officiel n'est jamais
 * remplacé — couper le réglage suffit à tout retirer, et les PDF, courriers
 * et e-mails continuent de porter la marque telle quelle.
 *
 * `debordement` : les décors sont dessinés dans un carré de 200 où le logo
 * n'occupe que les 56 % centraux. Le badge doit donc être plus grand que le
 * logo pour que l'araignée, le bonnet ou les œufs aient la place de
 * dépasser — d'où un conteneur agrandi et recentré autour de lui.
 *
 * Le réglage est lu une fois par chargement de page et mis en cache sur le
 * module : ce composant est monté dans le menu, affiché en permanence.
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
      // Un décor est un ornement : s'il échoue, le logo reste nu, sans le
      // moindre message à l'utilisateur.
      reglageEnCache = { actif: false, forcer: null };
      return reglageEnCache;
    })
    .finally(() => { demandeEnCours = null; });

  return demandeEnCours;
}

/**
 * Événement émis après un changement du réglage. Sans lui, le menu gardait
 * son décor précédent jusqu'au prochain rechargement complet de la page :
 * vider le cache ne suffit pas, le composant déjà monté ne relit rien de
 * lui-même. Même mécanisme que `user-updated` pour la photo de profil.
 */
const EVENEMENT_MAJ = 'habillage-saisonnier-maj';

/** À appeler après un changement du réglage : vide le cache ET prévient le menu. */
export function oublierHabillageEnCache(nouveauReglage = null) {
  reglageEnCache = nouveauReglage;
  window.dispatchEvent(new CustomEvent(EVENEMENT_MAJ, { detail: nouveauReglage }));
}

function LogoSaisonnier({ debordement = 1.8 }) {
  const [saison, setSaison] = useState(null);

  useEffect(() => {
    let annule = false;

    const appliquer = (reglage) => {
      if (annule) return;
      setSaison(reglage?.actif ? saisonActive(new Date(), reglage.forcer) : null);
    };

    chargerReglage().then(appliquer);

    // Le réglage vient d'être changé ailleurs dans l'application : on
    // applique la valeur reçue sans refaire d'appel réseau.
    const surMaj = (e) => (e.detail ? appliquer(e.detail) : chargerReglage().then(appliquer));
    window.addEventListener(EVENEMENT_MAJ, surMaj);

    return () => {
      annule = true;
      window.removeEventListener(EVENEMENT_MAJ, surMaj);
    };
  }, []);

  if (!saison) return null;

  const pourcent = `${debordement * 100}%`;
  const marge = `${((debordement - 1) / 2) * -100}%`;

  return (
    <span
      aria-hidden='true'
      style={{ position: 'absolute', left: marge, top: marge, width: pourcent, height: pourcent, pointerEvents: 'none' }}
    >
      {/* Sans logo : celui de la page se voit au centre, à travers le badge. */}
      <BadgeSaisonnier cle={saison} avecLogo={false} />
    </span>
  );
}

export default LogoSaisonnier;
