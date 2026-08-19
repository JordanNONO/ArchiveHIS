import { GET_API_TOKENS_API, CREATE_API_TOKEN_API, DELETE_API_TOKEN_API } from "..";

/**
 * Jetons d'API à portée large (accès complet aux données), pensés pour un
 * agent externe — voir ApiTokenController côté backend. Réservé aux
 * administrateurs.
 */
export async function getApiTokens() {
    const { url, ...meta } = GET_API_TOKENS_API;
    return await fetch(url, { ...meta, credentials: 'include', cache: 'no-store' });
}

/**
 * @param {{nom: string}} data
 */
export async function createApiToken(data) {
    const { url, ...meta } = CREATE_API_TOKEN_API;
    return await fetch(url, { ...meta, body: JSON.stringify(data), credentials: 'include' });
}

export async function deleteApiToken(id) {
    const { url, ...meta } = DELETE_API_TOKEN_API;
    return await fetch(url + `/${id}`, { ...meta, credentials: 'include' });
}
