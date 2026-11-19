/**
 * Paramètres d'adresse qui n'appartiennent à aucune page en particulier :
 * la fiche d'une personne ouverte par-dessus n'importe quelle page (voir
 * DossierPersonneContext). Une page qui réécrit ses propres paramètres
 * (filtres, recherche) doit les laisser en place.
 */
const PARAMS_GLOBAUX = ['fiche', 'ficheOnglet'];

export function avecParamsGlobaux(params) {
  const actuels = new URLSearchParams(window.location.search);
  const resultat = new URLSearchParams(params);
  PARAMS_GLOBAUX.forEach((cle) => {
    if (actuels.has(cle) && !resultat.has(cle)) resultat.set(cle, actuels.get(cle));
  });
  return resultat;
}

/**
 * Options d'une réécriture d'adresse « silencieuse » : remplace l'étape
 * courante (pas de nouvelle étape pour « retour ») et conserve l'état de
 * navigation (fenêtres ouvertes, étapes de formulaire — voir
 * GestionRetourFenetres).
 */
export function remplacementSilencieux() {
  return { replace: true, state: window.history.state?.usr };
}
