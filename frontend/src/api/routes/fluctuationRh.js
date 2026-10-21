import { FLUCTUATIONS_RH_API } from "..";

/**
 * Fluctuation RH — une seule constante d'URL de base (voir api/index.js),
 * chaque appel précise sa méthode : six routes sur le même préfixe.
 */
function appeler(chemin, method, data) {
    const { url, headers } = FLUCTUATIONS_RH_API;
    return fetch(url + chemin, {
        method,
        headers,
        credentials: 'include',
        ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
    });
}

/** mois au format "AAAA-MM" */
export function getFluctuationsRh(mois) {
    return appeler(`?mois=${encodeURIComponent(mois)}`, 'GET');
}

export function getMoisFluctuationsRh() {
    return appeler('/mois', 'GET');
}

/** Pour la carte du tableau de bord (Home.jsx) — voir FluctuationRhController::compteurs(). */
export function getCompteursFluctuationsRh() {
    return appeler('/compteurs', 'GET');
}

export function getSalariesFluctuationsRh() {
    return appeler('/salaries', 'GET');
}

export function createFluctuationRh(data) {
    return appeler('', 'POST', data);
}

export function updateFluctuationRh(id, data) {
    return appeler(`/${id}`, 'PUT', data);
}

export function deleteFluctuationRh(id) {
    return appeler(`/${id}`, 'DELETE');
}

/** blocs : [{ mois: "AAAA-MM", lignes: [...] }] */
export function importerFluctuationsRh(blocs, remplacer) {
    return appeler('/importer', 'POST', { mois: blocs, remplacer });
}

/** action : "valider" | "transmettre" | "rouvrir" */
export function changerStatutMoisFluctuationRh(mois, action) {
    return appeler(`/mois/${mois}/statut`, 'POST', { action });
}
