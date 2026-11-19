import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Une valeur d'état gardée dans l'adresse de la page (?nom=valeur) — une
 * étape de formulaire, un onglet, une période — pour que « retour » et le
 * retour sur la page la retrouvent, au lieu de repartir de l'état initial.
 *
 * `historique: 'push'` (défaut) : chaque changement est une étape que
 * « retour » défait (étape d'un formulaire, onglet). `'replace'` : la
 * valeur est seulement mémorisée, sans étape (une période qu'on fait
 * défiler mois par mois ne doit pas obliger à 12 « retour »).
 *
 * L'état de navigation (location.state) est conservé, ainsi que les autres
 * paramètres de l'adresse.
 */
export function useParamUrl(nom, defaut = '', { historique = 'push' } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const valeur = new URLSearchParams(location.search).get(nom) ?? defaut;

  const changer = useCallback((nouvelle, options = {}) => {
    const params = new URLSearchParams(window.location.search);
    if (nouvelle === null || nouvelle === undefined || nouvelle === '' || nouvelle === defaut) params.delete(nom);
    else params.set(nom, String(nouvelle));
    const search = params.toString();
    if (`?${search}` === window.location.search || (!search && !window.location.search)) return;
    navigate(
      { pathname: window.location.pathname, search: search ? `?${search}` : '', hash: window.location.hash },
      { replace: (options.historique || historique) === 'replace', state: window.history.state?.usr },
    );
  }, [nom, defaut, historique, navigate]);

  return [valeur, changer];
}
