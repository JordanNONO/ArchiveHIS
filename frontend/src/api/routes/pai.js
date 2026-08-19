import { GET_PAI_API, CREATE_PAI_API, UPDATE_PAI_API, PAI_COMPTEURS_API, CLOTURER_PAI_API, REOUVRIR_PAI_API, CREATE_PAI_OBJECTIF_API, TOGGLE_PAI_OBJECTIF_API, DELETE_PAI_OBJECTIF_API, UPDATE_PAI_OBJECTIF_API } from "..";

/**
 * Dossiers PAI (Projet d'Accompagnement Individualisé) — voir PaiController.
 * @param {boolean} [cloture] - true pour les dossiers clôturés, sinon les dossiers actifs.
 */
export async function getPaiDossiers(cloture = false) {
    const { url, ...meta } = GET_PAI_API;
    return await fetch(`${url}?cloture=${cloture ? '1' : '0'}`, { ...meta, credentials: 'include' });
}

export async function getPaiDossier(id) {
    const { url, ...meta } = GET_PAI_API;
    return await fetch(`${url}/${id}`, { ...meta, credentials: 'include' });
}

/**
 * @param {{titre:string, personnel_concerne_id?:number, nom_beneficiaire?:string, responsable_secteur_id:number, description?:string, date_ouverture?:string}} data
 */
export async function createPaiDossier(data) {
    const { url, ...meta } = CREATE_PAI_API;
    return await fetch(url, { ...meta, body: JSON.stringify(data), credentials: 'include' });
}

/**
 * @param {{titre:string, personnel_concerne_id?:number, nom_beneficiaire?:string, responsable_secteur_id:number, description?:string}} data
 */
export async function updatePaiDossier(id, data) {
    const { url, ...meta } = UPDATE_PAI_API;
    return await fetch(`${url}/${id}`, { ...meta, body: JSON.stringify(data), credentials: 'include' });
}

/** Compteurs agrégés (dossiers actifs, objectifs en retard) pour la tuile du tableau de bord. */
export async function getPaiCompteurs() {
    const { url, ...meta } = PAI_COMPTEURS_API;
    return await fetch(url, { ...meta, credentials: 'include' });
}

export async function cloturerPaiDossier(id) {
    const { url, ...meta } = CLOTURER_PAI_API;
    return await fetch(`${url}/${id}/cloturer`, { ...meta, credentials: 'include' });
}

export async function reouvrirPaiDossier(id) {
    const { url, ...meta } = REOUVRIR_PAI_API;
    return await fetch(`${url}/${id}/reouvrir`, { ...meta, credentials: 'include' });
}

/** @param {{description:string, echeance:string}} data */
export async function createPaiObjectif(dossierId, data) {
    const { url, ...meta } = CREATE_PAI_OBJECTIF_API;
    return await fetch(`${url}/${dossierId}/objectifs`, { ...meta, body: JSON.stringify(data), credentials: 'include' });
}

export async function togglePaiObjectif(id) {
    const { url, ...meta } = TOGGLE_PAI_OBJECTIF_API;
    return await fetch(`${url}/${id}/toggle`, { ...meta, credentials: 'include' });
}

/** @param {{description:string, echeance:string}} data */
export async function updatePaiObjectif(id, data) {
    const { url, ...meta } = UPDATE_PAI_OBJECTIF_API;
    return await fetch(`${url}/${id}`, { ...meta, body: JSON.stringify(data), credentials: 'include' });
}

export async function deletePaiObjectif(id) {
    const { url, ...meta } = DELETE_PAI_OBJECTIF_API;
    return await fetch(`${url}/${id}`, { ...meta, credentials: 'include' });
}
