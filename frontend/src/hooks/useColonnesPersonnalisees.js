import { useCallback, useState } from 'react';
import { useOrdrePersonnalise } from './useOrdrePersonnalise';

/**
 * Ordre ET visibilité des colonnes d'un tableau, personnalisables par
 * personne (mémorisé par appareil, comme useOrdrePersonnalise — pas une
 * donnée à synchroniser entre appareils). `colonnesParDefaut` est la liste
 * des colonnes que cette personne peut réorganiser/masquer (les colonnes
 * verrouillées comme le N° ou les actions n'en font pas partie, voir
 * l'appelant). Chaque colonne est un objet { cle, label, ... } ; l'ordre est
 * mémorisé par `cle` (voir useOrdrePersonnalise), la visibilité séparément.
 */
export function useColonnesPersonnalisees(cleStockage, colonnesParDefaut) {
  const clesParDefaut = colonnesParDefaut.map((c) => c.cle);
  const [ordre, setOrdre] = useOrdrePersonnalise(`${cleStockage}_ordre`, clesParDefaut);

  const [cachees, setCacheesEtat] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(`${cleStockage}_cachees`) || '[]');
      return Array.isArray(v) ? v.filter((cle) => clesParDefaut.includes(cle)) : [];
    } catch {
      return [];
    }
  });

  const setCachees = useCallback((nouvelles) => {
    setCacheesEtat(nouvelles);
    try { localStorage.setItem(`${cleStockage}_cachees`, JSON.stringify(nouvelles)); } catch { /* stockage indisponible, tant pis */ }
  }, [cleStockage]);

  function reinitialiser() {
    setOrdre(clesParDefaut);
    setCachees([]);
  }

  const parCle = Object.fromEntries(colonnesParDefaut.map((c) => [c.cle, c]));
  const colonnesTriees = ordre.map((cle) => parCle[cle]).filter(Boolean);
  const colonnesVisibles = colonnesTriees.filter((c) => !cachees.includes(c.cle));

  return { colonnesTriees, colonnesVisibles, ordre, setOrdre, cachees, setCachees, reinitialiser };
}
