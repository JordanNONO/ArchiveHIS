import { useEffect, useRef } from 'react';

/**
 * Pour une fenêtre dont l'ouverture est pilotée par React (pas une <dialog>
 * fermée par showModal()/close()) : « retour » appelle `onFermer` au lieu
 * de fermer l'élément de l'extérieur, ce qui laisserait l'état React
 * persuadé que la fenêtre est encore ouverte. Voir GestionRetourFenetres.
 */
export function useFermetureParRetour(ref, onFermer) {
  const rappel = useRef(onFermer);
  rappel.current = onFermer;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const surRetour = (e) => {
      e.preventDefault();
      rappel.current?.();
    };
    el.addEventListener('fermeture-retour', surRetour);
    return () => el.removeEventListener('fermeture-retour', surRetour);
  });
}
