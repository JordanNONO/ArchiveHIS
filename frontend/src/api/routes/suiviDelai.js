import { ETAPES_WORKFLOW_CATEGORIE_API, DEMARRER_SUIVI_DELAI_API, AVANCER_SUIVI_DELAI_API, CLOTURER_SUIVI_DELAI_API } from "..";

/**
 * Étapes de la procédure de délai définie pour une catégorie — un tableau
 * vide signifie qu'aucune procédure n'existe pour ce type de dossier (ex:
 * toutes les catégories sauf "SortieRupture" aujourd'hui), ce qui permet au
 * frontend de masquer le bouton "Démarrer le suivi de délai" plutôt que de
 * laisser l'utilisateur cliquer dans le vide.
 */
export async function getEtapesWorkflowCategorie(categorieId) {
    const { url, ...meta } = ETAPES_WORKFLOW_CATEGORIE_API;
    return await fetch(url + `/${categorieId}/etapes-workflow`, { ...meta, credentials: 'include' })
}

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
