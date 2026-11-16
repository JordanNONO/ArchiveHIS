import {
    TELEPHONIE_API, TELEPHONIE_SALARIES_SANS_API, TELEPHONIE_SALARIES_API, TELEPHONIE_LIGNE_CODES_API,
    CREATE_TELEPHONIE_APPAREIL_API, UPDATE_TELEPHONIE_APPAREIL_API, DELETE_TELEPHONIE_APPAREIL_API,
    CREATE_TELEPHONIE_LIGNE_API, UPDATE_TELEPHONIE_LIGNE_API, DELETE_TELEPHONIE_LIGNE_API,
    CREATE_TELEPHONIE_REMISE_API, CLOTURER_TELEPHONIE_DETENTION_API, CREATE_TELEPHONIE_REPRISE_API,
    CREATE_TELEPHONIE_INCIDENT_API, UPDATE_TELEPHONIE_INCIDENT_API, DELETE_TELEPHONIE_INCIDENT_API,
} from '..';

/**
 * Parc des téléphones et des lignes SIM confiés aux salariés — deux
 * inventaires indépendants reliés par des détentions (voir
 * backend/app/Http/Controllers/TelephonieController.php).
 */

/** Tout le parc en une requête : les quatre onglets lisent les mêmes données. */
export async function getTelephonie() {
    const { url, ...meta } = TELEPHONIE_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

/** Qui n'a encore rien d'enregistré — alimente l'écran de reprise de l'existant. */
export async function getSalariesSansTelephone() {
    const { url, ...meta } = TELEPHONIE_SALARIES_SANS_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

/**
 * Tous les salariés qu'on peut choisir dans les formulaires (remise,
 * transfert, incident) : comptes du personnel + noms de la Fluctuation RH —
 * un intervenant sans compte applicatif n'a souvent qu'un nom tapé par la RH,
 * jamais de fiche (voir TelephonieController::salaries()).
 */
export async function getSalariesTelephonie() {
    const { url, ...meta } = TELEPHONIE_SALARIES_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

/**
 * Les codes PIN/PUK d'une ligne. Jamais renvoyés dans la liste du parc, et
 * chaque lecture est journalisée côté serveur : un code d'accès qui s'affiche
 * sans laisser de trace n'est plus un code d'accès.
 */
export async function getCodesLigne(id) {
    const { url, ...meta } = TELEPHONIE_LIGNE_CODES_API;
    return await fetch(`${url}/${id}/codes`, { ...meta, credentials: 'include' })
}

export async function createAppareil(data) {
    const { url, ...meta } = CREATE_TELEPHONIE_APPAREIL_API;
    return await fetch(url, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function updateAppareil(id, data) {
    const { url, ...meta } = UPDATE_TELEPHONIE_APPAREIL_API;
    return await fetch(`${url}/${id}`, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function deleteAppareil(id) {
    const { url, ...meta } = DELETE_TELEPHONIE_APPAREIL_API;
    return await fetch(`${url}/${id}`, { ...meta, credentials: 'include' })
}

export async function createLigne(data) {
    const { url, ...meta } = CREATE_TELEPHONIE_LIGNE_API;
    return await fetch(url, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function updateLigne(id, data) {
    const { url, ...meta } = UPDATE_TELEPHONIE_LIGNE_API;
    return await fetch(`${url}/${id}`, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function deleteLigne(id) {
    const { url, ...meta } = DELETE_TELEPHONIE_LIGNE_API;
    return await fetch(`${url}/${id}`, { ...meta, credentials: 'include' })
}

/** Confier un téléphone et/ou une ligne à un salarié. */
export async function createRemise(data) {
    const { url, ...meta } = CREATE_TELEPHONIE_REMISE_API;
    return await fetch(url, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

/**
 * Clôturer une détention : restitution, transfert, incident ou fin de
 * contrat. Un transfert (`motif_fin: 'transfert'` + `vers_personnel_id`)
 * enchaîne directement sur une nouvelle détention, sans que le matériel
 * repasse par le stock.
 */
export async function cloturerDetention(id, data) {
    const { url, ...meta } = CLOTURER_TELEPHONIE_DETENTION_API;
    return await fetch(`${url}/${id}/cloturer`, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

/** Saisie rapide de l'existant : un modèle et un numéro suffisent. */
export async function createReprise(data) {
    const { url, ...meta } = CREATE_TELEPHONIE_REPRISE_API;
    return await fetch(url, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function createIncident(data) {
    const { url, ...meta } = CREATE_TELEPHONIE_INCIDENT_API;
    return await fetch(url, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function updateIncident(id, data) {
    const { url, ...meta } = UPDATE_TELEPHONIE_INCIDENT_API;
    return await fetch(`${url}/${id}`, { ...meta, body: JSON.stringify(data), credentials: 'include' })
}

export async function deleteIncident(id) {
    const { url, ...meta } = DELETE_TELEPHONIE_INCIDENT_API;
    return await fetch(`${url}/${id}`, { ...meta, credentials: 'include' })
}
