import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { useGardeDepart } from '../contexts/GardeDepartContext';

const CLE = '__fenetres';
// L'état de l'historique survit à un rechargement de la page : sans ce
// préfixe propre à la session, une nouvelle fenêtre « f1 » se confondrait
// avec la « f1 » d'avant le rechargement.
const SESSION = Date.now().toString(36);
const SELECTEUR = 'dialog[open]:not([data-sans-historique]), [data-fenetre-historique]';

/**
 * Le bouton « retour » referme la fenêtre ouverte au lieu de quitter la
 * page — pour TOUTES les fenêtres de l'application d'un coup (≈35), comme
 * useFenetresDialogueDeplacables le fait déjà pour le déplacement : aucune
 * fenêtre n'a besoin d'être modifiée.
 *
 * À l'ouverture d'une fenêtre (une <dialog> native, ou un élément marqué
 * `data-fenetre-historique`), une étape est ajoutée à l'historique — même
 * adresse, seul l'état change. « Retour » revient à l'étape d'avant : la
 * fenêtre est alors refermée. Refermée par l'application elle-même (✕,
 * Échap, enregistrement), l'étape ajoutée est retirée, pour qu'un « retour »
 * suivant ne tombe pas sur une étape vide.
 *
 * Fermeture par « retour » : l'évènement `fermeture-retour` est d'abord
 * envoyé à la fenêtre ; une fenêtre pilotée par React l'intercepte
 * (preventDefault) et se ferme elle-même (voir useFermetureParRetour). À
 * défaut, une <dialog> native est simplement fermée.
 */
export default function GestionRetourFenetres() {
  const location = useLocation();
  const typeNavigation = useNavigationType();
  const navigate = useNavigate();
  const { laisserPasser } = useGardeDepart();
  const identifiants = useRef(new WeakMap());
  const compteur = useRef(0);
  const ouvertes = useRef(new Set());
  const fermeesParRetour = useRef(new Set());
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  function idDe(el) {
    if (!identifiants.current.has(el)) identifiants.current.set(el, `${SESSION}-${++compteur.current}`);
    return identifiants.current.get(el);
  }

  useEffect(() => {
    let image = 0;

    // L'état réel de l'historique, pas une copie React possiblement en
    // retard d'un rendu : une fenêtre refermée juste avant une navigation
    // de l'application (ex. « ouvrir le document ») ne doit rien dépiler.
    const etatHistorique = () => window.history.state?.usr || {};

    function ouverture(el) {
      const id = idDe(el);
      const pile = etatHistorique()[CLE] || [];
      if (pile.some((f) => f.id === id)) return;
      const { pathname, search, hash } = window.location;
      navigateRef.current(
        { pathname, search, hash },
        { state: { ...etatHistorique(), [CLE]: [...pile, { id, idx: window.history.state?.idx ?? 0 }] } },
      );
    }

    function fermeture(el) {
      const id = idDe(el);
      if (fermeesParRetour.current.delete(id)) return;
      const pile = etatHistorique()[CLE] || [];
      const entree = pile.find((f) => f.id === id);
      const idx = window.history.state?.idx;
      if (!entree || typeof idx !== 'number' || idx <= entree.idx) return;
      laisserPasser();
      navigateRef.current(entree.idx - idx);
    }

    function verifier() {
      image = 0;
      const actuelles = new Set(document.querySelectorAll(SELECTEUR));
      actuelles.forEach((el) => { if (!ouvertes.current.has(el)) ouverture(el); });
      ouvertes.current.forEach((el) => { if (!actuelles.has(el)) fermeture(el); });
      ouvertes.current = actuelles;
    }

    const observateur = new MutationObserver(() => {
      if (!image) image = requestAnimationFrame(verifier);
    });
    observateur.observe(document.body, { attributes: true, attributeFilter: ['open', 'data-fenetre-historique'], childList: true, subtree: true });
    verifier();

    return () => {
      observateur.disconnect();
      if (image) cancelAnimationFrame(image);
    };
  }, [laisserPasser]);

  // « Retour » (ou « suivant ») : toute fenêtre ouverte absente de l'étape
  // atteinte est refermée. Seulement sur un vrai retour/suivant (POP) : une
  // page qui réécrit son adresse toute seule (filtres, recherche) pendant
  // qu'une fenêtre est ouverte ne doit jamais la fermer.
  useEffect(() => {
    if (typeNavigation !== 'POP') return;
    const presentes = new Set((location.state?.[CLE] || []).map((f) => f.id));
    ouvertes.current.forEach((el) => {
      const id = identifiants.current.get(el);
      if (!id || presentes.has(id)) return;
      fermeesParRetour.current.add(id);
      const interceptee = !el.dispatchEvent(new CustomEvent('fermeture-retour', { cancelable: true }));
      if (!interceptee && el.tagName === 'DIALOG') el.close();
    });
  }, [location, typeNavigation]);

  return null;
}
