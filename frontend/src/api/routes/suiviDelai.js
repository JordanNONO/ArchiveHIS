import { DEMARRER_SUIVI_DELAI_API, AVANCER_SUIVI_DELAI_API, CLOTURER_SUIVI_DELAI_API } from "..";

/**
 * Démarre le suivi de délai d'un document sur la première étape de la
 * procédure définie pour sa catégorie (ex: la lettre de démission ouvre
 * "Courrier initial").
 */
export async function demarrerSuiviDelai(documentId) {
    const { url, ...meta } = DEMARRER_SUIVI_DELAI_API;
    return await fetch(url + `/${documentId}/suivi-delai`, { ...meta, credentials: 'include' })
}

/**
 * Fait passer un suivi à l'étape suivante de la procédure (ou la termine s'il
 * n'y en a pas d'autre).
 */
export async function avancerSuiviDelai(suiviId) {
    const { url, ...meta } = AVANCER_SUIVI_DELAI_API;
    return await fetch(url + `/${suiviId}/avancer`, { ...meta, credentials: 'include' })
}

export async function cloturerSuiviDelai(suiviId) {
    const { url, ...meta } = CLOTURER_SUIVI_DELAI_API;
    return await fetch(url + `/${suiviId}/cloturer`, { ...meta, credentials: 'include' })
}
