import { useCallback, useState } from 'react';

/**
 * Ordre d'une liste de widgets/liens (tableau de bord, barre latérale)
 * mémorisé par appareil (localStorage, comme la largeur de la barre latérale
 * dans MainLayout.jsx — une préférence d'affichage personnelle, pas une
 * donnée à synchroniser entre appareils).
 *
 * `idsParDefaut` peut varier d'une personne à l'autre (permissions) : les id
 * déjà connus dans l'ordre stocké sont conservés dans cet ordre, les
 * nouveaux id jamais vus (nouvelle carte ajoutée depuis, permission
 * nouvellement accordée...) sont ajoutés à la fin, et les id qui n'existent
 * plus sont silencieusement retirés.
 */
export function useOrdrePersonnalise(cleStockage, idsParDefaut) {
  const [ordre, setOrdreEtat] = useState(() => {
    try {
      const stocke = JSON.parse(localStorage.getItem(cleStockage) || 'null');
      if (!Array.isArray(stocke)) return idsParDefaut;
      const connus = stocke.filter((id) => idsParDefaut.includes(id));
      const nouveaux = idsParDefaut.filter((id) => !stocke.includes(id));
      return [...connus, ...nouveaux];
    } catch {
      return idsParDefaut;
    }
  });

  const setOrdre = useCallback((nouvelOrdre) => {
    setOrdreEtat(nouvelOrdre);
    try { localStorage.setItem(cleStockage, JSON.stringify(nouvelOrdre)); } catch { /* stockage indisponible, tant pis */ }
  }, [cleStockage]);

  return [ordre, setOrdre];
}
