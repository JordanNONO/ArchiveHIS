import { useCallback, useMemo, useState } from 'react';

function lireStockage(cleStockage) {
  try {
    const stocke = JSON.parse(localStorage.getItem(cleStockage) || 'null');
    return Array.isArray(stocke) ? stocke : null;
  } catch {
    return null;
  }
}

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
 *
 * Ce rapprochement est refait à chaque fois que `idsParDefaut` change, pas
 * seulement au premier affichage : la barre latérale se monte AVANT que
 * /auth/me ait rempli les permissions (voir useAuthStatus.js). Calculé une
 * seule fois, l'ordre restait figé sur la liste « sans droits » et les liens
 * réservés (Téléphonie, Fluctuation RH) n'apparaissaient jamais — c'était le
 * cas à chaque ouverture de l'appli installée sur téléphone, qui repart
 * d'une session vide.
 */
export function useOrdrePersonnalise(cleStockage, idsParDefaut) {
  const [stocke, setStocke] = useState(() => lireStockage(cleStockage));
  const cleIds = idsParDefaut.join('|');

  const ordre = useMemo(() => {
    if (!stocke) return idsParDefaut;
    const connus = stocke.filter((id) => idsParDefaut.includes(id));
    const nouveaux = idsParDefaut.filter((id) => !stocke.includes(id));
    return [...connus, ...nouveaux];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocke, cleIds]);

  const setOrdre = useCallback((nouvelOrdre) => {
    setStocke(nouvelOrdre);
    try { localStorage.setItem(cleStockage, JSON.stringify(nouvelOrdre)); } catch { /* stockage indisponible, tant pis */ }
  }, [cleStockage]);

  return [ordre, setOrdre];
}
