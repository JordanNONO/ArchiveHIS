import { useCallback, useEffect, useRef, useState } from 'react';

// Dimensions d'une carte de DocumentGrid.jsx (h-[150px], gap-4).
const LARGEUR_MIN_CARTE = 180;
const HAUTEUR_CARTE = 150;
const ECART = 16;
// Place gardée sous la grille pour la pagination (mt-6 + boutons h-8).
const MARGE_BAS = 80;

/**
 * Nombre de colonnes et de documents par page qui remplissent réellement la
 * place disponible, au lieu d'un nombre fixe (12/24) qui laissait la moitié
 * d'un grand écran vide. `ref` est un callback ref : la mesure démarre dès que
 * le conteneur apparaît, même s'il est rendu après coup (ex: OpenFolder, qui
 * n'affiche la grille qu'une fois un sous-dossier ouvert).
 */
export function useGrillePagination({ rangeesMin = 2, colonnesParDefaut = 6 } = {}) {
  const [noeud, setNoeud] = useState(null);
  const [taille, setTaille] = useState({ colonnes: colonnesParDefaut, parPage: colonnesParDefaut * rangeesMin });
  const ref = useCallback((el) => setNoeud(el), []);
  const frame = useRef(0);

  useEffect(() => {
    if (!noeud) return;
    const calculer = () => {
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        const largeur = noeud.clientWidth;
        const haut = noeud.getBoundingClientRect().top + window.scrollY;
        const hauteur = window.innerHeight - haut - MARGE_BAS;
        const colonnes = Math.max(1, Math.floor((largeur + ECART) / (LARGEUR_MIN_CARTE + ECART)));
        const rangees = Math.max(rangeesMin, Math.floor((hauteur + ECART) / (HAUTEUR_CARTE + ECART)));
        setTaille((prev) => (prev.colonnes === colonnes && prev.parPage === colonnes * rangees
          ? prev
          : { colonnes, parPage: colonnes * rangees }));
      });
    };
    calculer();
    const ro = new ResizeObserver(calculer);
    ro.observe(noeud);
    window.addEventListener('resize', calculer);
    return () => {
      cancelAnimationFrame(frame.current);
      ro.disconnect();
      window.removeEventListener('resize', calculer);
    };
  }, [noeud, rangeesMin]);

  return { ref, ...taille };
}
