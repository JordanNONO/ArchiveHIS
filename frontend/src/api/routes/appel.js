import { GET_APPELS_API, APPELS_COMPTEURS_API, CREATE_APPEL_API, UPDATE_APPEL_API, MARQUER_APPEL_TRAITE_API, DELETE_APPEL_API } from "..";

/**
 * Registre des appels téléphoniques — table dédiée, indépendante des
 * documents/courriers (voir backend/app/Models/AppelTelephonique.php).
 */
export async function getAppels() {
    const { url, ...meta } = GET_APPELS_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

export async function getAppelsCompteurs() {
    const { url, ...meta } = APPELS_COMPTEURS_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

export async function createAppel(data) {
    const { url, ...meta } = CREATE_APPEL_API;
    return await fetch(url, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function updateAppel(id, data) {
    const { url, ...meta } = UPDATE_APPEL_API;
    return await fetch(url + `/${id}`, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function marquerAppelTraite(id, noteTraitement) {
    const { url, ...meta } = MARQUER_APPEL_TRAITE_API;
    return await fetch(url + `/${id}/marquer-traite`, { ...meta, body: JSON.stringify({ note_traitement: noteTraitement || null }), credentials: 'include' })
}

export async function deleteAppel(id) {
    const { url, ...meta } = DELETE_APPEL_API;
    return await fetch(url + `/${id}`, { ...meta, credentials: 'include' })
}
