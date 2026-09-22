import { useEffect } from 'react';

// Zone "barre de titre" en haut de la fenêtre — seule zone qui déclenche le
// déplacement (le reste du contenu, champs, boutons, reste cliquable
// normalement).
const HAUTEUR_ZONE_POIGNEE = 56;
const SELECTEUR_FENETRE = '.modal-box';
const SELECTEUR_ELEMENTS_INTERACTIFS = 'button, a, input, textarea, select, label, [role="button"]';

function estElementInteractif(cible) {
  return !!cible.closest(SELECTEUR_ELEMENTS_INTERACTIFS);
}

/**
 * Rend déplaçables (comme une fenêtre Windows) toutes les fenêtres de
 * dialogue de l'appli — chèques, courriers, partage de document, etc. —
 * c'est-à-dire tout ce qui utilise `.modal-box` (DaisyUI), qu'il s'agisse
 * d'un `<dialog>` natif (`showModal()`) ou d'une div `.modal.modal-open`
 * (voir PersonnelModal.jsx).
 *
 * Se monte une seule fois de façon globale (voir App.js) plutôt qu'en tant
 * que composant par fenêtre : aucune des ~20 boîtes de dialogue existantes
 * n'a besoin d'être modifiée individuellement. La détection se fait par
 * délégation d'évènements sur `document` + une zone de préhension
 * positionnelle (le haut de la boîte, hors éléments interactifs comme le
 * bouton fermer), ce qui tolère les structures de header légèrement
 * différentes d'un formulaire à l'autre.
 *
 * La position est toujours réinitialisée (recentrage) à l'ouverture — elle
 * n'est pas mémorisée d'une ouverture à l'autre.
 */
export function useFenetresDialogueDeplacables() {
  useEffect(() => {
    let fenetreActive = null;
    let decalageX = 0;
    let decalageY = 0;

    function surPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      const fenetre = e.target.closest(SELECTEUR_FENETRE);
      if (!fenetre) return;
      if (estElementInteractif(e.target)) return;

      const rect = fenetre.getBoundingClientRect();
      if (e.clientY - rect.top > HAUTEUR_ZONE_POIGNEE) return;

      fenetreActive = fenetre;
      decalageX = e.clientX - rect.left;
      decalageY = e.clientY - rect.top;

      fenetre.style.position = 'fixed';
      fenetre.style.margin = '0';
      fenetre.style.top = `${rect.top}px`;
      fenetre.style.left = `${rect.left}px`;
      fenetre.style.touchAction = 'none';
      fenetre.classList.add('select-none');
    }

    function surPointerMove(e) {
      if (!fenetreActive) return;
      const largeur = fenetreActive.offsetWidth;
      let top = e.clientY - decalageY;
      let left = e.clientX - decalageX;
      top = Math.min(Math.max(top, 0), window.innerHeight - HAUTEUR_ZONE_POIGNEE);
      left = Math.min(Math.max(left, -(largeur - 80)), window.innerWidth - 80);
      fenetreActive.style.top = `${top}px`;
      fenetreActive.style.left = `${left}px`;
    }

    function arreterDeplacement() {
      if (fenetreActive) {
        fenetreActive.classList.remove('select-none');
        fenetreActive.style.touchAction = '';
      }
      fenetreActive = null;
    }

    function reinitialiserSiFerme(mutations) {
      for (const mutation of mutations) {
        const cible = mutation.target;
        if (!(cible instanceof HTMLElement)) continue;
        const estOuvert = cible.hasAttribute('open') || cible.classList.contains('modal-open');
        if (estOuvert) continue;
        const fenetre = cible.querySelector(SELECTEUR_FENETRE);
        if (fenetre) {
          fenetre.style.position = '';
          fenetre.style.top = '';
          fenetre.style.left = '';
          fenetre.style.margin = '';
        }
      }
    }

    document.addEventListener('pointerdown', surPointerDown);
    document.addEventListener('pointermove', surPointerMove);
    document.addEventListener('pointerup', arreterDeplacement);
    document.addEventListener('pointercancel', arreterDeplacement);

    const observateur = new MutationObserver(reinitialiserSiFerme);
    observateur.observe(document.body, { attributes: true, attributeFilter: ['open', 'class'], subtree: true });

    return () => {
      document.removeEventListener('pointerdown', surPointerDown);
      document.removeEventListener('pointermove', surPointerMove);
      document.removeEventListener('pointerup', arreterDeplacement);
      document.removeEventListener('pointercancel', arreterDeplacement);
      observateur.disconnect();
    };
  }, []);
}
