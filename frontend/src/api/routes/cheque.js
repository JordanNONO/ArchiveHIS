import { GET_CHEQUES_API, CHEQUES_COMPTEURS_API, CREATE_CHEQUE_API, UPDATE_CHEQUE_API, MARQUER_CHEQUE_TRAITE_API, DELETE_CHEQUE_API } from "..";

/**
 * Registre des chèques reçus — table dédiée, indépendante des documents/
 * courriers (voir backend/app/Models/Cheque.php).
 */
export async function getCheques() {
    const { url, ...meta } = GET_CHEQUES_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

export async function getChequesCompteurs() {
    const { url, ...meta } = CHEQUES_COMPTEURS_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

export async function createCheque(data) {
    const { url, ...meta } = CREATE_CHEQUE_API;
    return await fetch(url, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function updateCheque(id, data) {
    const { url, ...meta } = UPDATE_CHEQUE_API;
    return await fetch(url + `/${id}`, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function marquerChequeTraite(id, noteTraitement) {
    const { url, ...meta } = MARQUER_CHEQUE_TRAITE_API;
    return await fetch(url + `/${id}/marquer-traite`, { ...meta, body: JSON.stringify({ note_traitement: noteTraitement || null }), credentials: 'include' })
}

export async function deleteCheque(id) {
    const { url, ...meta } = DELETE_CHEQUE_API;
    return await fetch(url + `/${id}`, { ...meta, credentials: 'include' })
}
