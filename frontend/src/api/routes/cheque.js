import { GET_CHEQUES_API, CHEQUES_COMPTEURS_API, CREATE_CHEQUE_API, UPDATE_CHEQUE_API, MARQUER_CHEQUE_TRAITE_API, DELETE_CHEQUE_API, CHEQUE_SCAN_API } from "..";

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

export async function createCheque(data, fichier) {
    const { url, headers, ...meta } = CREATE_CHEQUE_API;

    // Scan/photo du chèque facultatif : bascule en FormData uniquement s'il y
    // en a un, sinon on garde le JSON simple habituel (pas de fichier =
    // Content-Type multipart inutile).
    if (!fichier) {
        return await fetch(url, { ...meta, headers, body: JSON.stringify(data), credentials: 'include' })
    }

    const formData = new FormData();
    for (const cle in data) {
        if (data[cle] !== undefined && data[cle] !== null) formData.append(cle, data[cle]);
    }
    formData.append('fichier', fichier);
    const { "Content-Type": _sansContentType, ...headersSansJson } = headers;
    return await fetch(url, { ...meta, headers: headersSansJson, body: formData, credentials: 'include' })
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

/** Scan/photo du chèque joint à l'enregistrement (voir ChequeForm.jsx) — ouvert dans un nouvel onglet, pas de téléchargement forcé côté serveur. */
export async function getChequeScan(id) {
    const { url, ...meta } = CHEQUE_SCAN_API;
    return await fetch(url + `/${id}/scan`, { ...meta, credentials: 'include' })
}
