import React, { createContext, useCallback, useContext, useEffect, useId, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { useConfirm } from './ConfirmDialogContext';

/**
 * Garde UNIQUE contre la perte d'une saisie (bouton retour, lien, fermeture
 * de l'onglet). React Router ne gère qu'un seul blocage actif à la fois
 * (useBlocker) : chaque écran s'inscrit donc ici via useConfirmerDepart(),
 * plutôt que d'appeler useBlocker lui-même — deux écrans montés ensemble
 * (un formulaire dans une fenêtre au-dessus d'une page) se marcheraient
 * dessus sinon.
 */
const GardeDepartContext = createContext(null);

const cheminDifferent = (actuelle, suivante) => actuelle.pathname !== suivante.pathname;

/** Navigation qui referme une fenêtre (voir GestionRetourFenetres) ou quitte la page. */
export function fermeUneFenetreOuQuitte(actuelle, suivante) {
  const avant = actuelle.state?.__fenetres?.length || 0;
  const apres = suivante.state?.__fenetres?.length || 0;
  return apres < avant || cheminDifferent(actuelle, suivante);
}

export function GardeDepartProvider({ children }) {
  const gardes = useRef(new Map());
  const passeDroit = useRef(false);
  const bloqueePar = useRef(null);
  const confirm = useConfirm();

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (passeDroit.current) {
      passeDroit.current = false;
      return false;
    }
    for (const garde of gardes.current.values()) {
      if (!garde.actif || !garde.bloquer(currentLocation, nextLocation)) continue;
      if (garde.laisser) {
        garde.laisser = false;
        continue;
      }
      bloqueePar.current = garde;
      return true;
    }
    return false;
  });

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const garde = bloqueePar.current;
    confirm({
      title: garde?.titre || 'Quitter sans enregistrer ?',
      message: garde?.message || 'Ce que vous avez saisi n’est pas enregistré et sera perdu.',
      confirmLabel: 'Quitter sans enregistrer',
      cancelLabel: 'Rester',
      danger: true,
    }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
  }, [blocker, confirm]);

  // Fermeture/rechargement de l'onglet : seule la boîte du navigateur est
  // possible ici (texte imposé par le navigateur).
  useEffect(() => {
    function avantFermeture(e) {
      if ([...gardes.current.values()].some((g) => g.actif)) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', avantFermeture);
    return () => window.removeEventListener('beforeunload', avantFermeture);
  }, []);

  const laisserPasser = useCallback(() => { passeDroit.current = true; }, []);

  return (
    <GardeDepartContext.Provider value={{ gardes, laisserPasser }}>
      {children}
    </GardeDepartContext.Provider>
  );
}

export function useGardeDepart() {
  return useContext(GardeDepartContext);
}

/**
 * Demande confirmation avant de perdre une saisie tant que `actif` est vrai.
 * `bloquer(actuelle, suivante)` décide quelles navigations sont concernées
 * (par défaut : quitter la page). Rend `laisserPartir()`, à appeler juste
 * avant une navigation voulue (après un enregistrement réussi, par exemple).
 */
export function useConfirmerDepart(actif, { message, titre, bloquer } = {}) {
  const { gardes } = useContext(GardeDepartContext);
  const id = useId();
  const garde = useRef({ actif: false, laisser: false });
  garde.current.actif = !!actif;
  garde.current.message = message;
  garde.current.titre = titre;
  garde.current.bloquer = bloquer || cheminDifferent;
  if (!actif) garde.current.laisser = false;

  useEffect(() => {
    const registre = gardes.current;
    registre.set(id, garde.current);
    return () => { registre.delete(id); };
  }, [gardes, id]);

  return useCallback(() => { garde.current.laisser = true; }, []);
}
