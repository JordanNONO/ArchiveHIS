import { PARTAGE_EXTERNE_API } from "..";

/**
 * Ces appels s'adressent à un espace public (pas d'authentification personnel) :
 * aucun ne porte de jeton Bearer, seul le token du lien identifie le partage.
 */
export async function getInfosPartage(token) {
    return await fetch(`${PARTAGE_EXTERNE_API.url}/${token}`, { headers: PARTAGE_EXTERNE_API.headers })
}

export async function demanderCode(token) {
    return await fetch(`${PARTAGE_EXTERNE_API.url}/${token}/code`, { method: 'POST', headers: PARTAGE_EXTERNE_API.headers })
}

export async function verifierCode(token, code) {
    return await fetch(`${PARTAGE_EXTERNE_API.url}/${token}/verifier`, {
        method: 'POST',
        headers: PARTAGE_EXTERNE_API.headers,
        body: JSON.stringify({ code }),
    })
}

export async function getDocumentPartage(token, session) {
    return await fetch(`${PARTAGE_EXTERNE_API.url}/${token}/document?session=${encodeURIComponent(session)}`, { headers: PARTAGE_EXTERNE_API.headers })
}

export function lienTelechargementPartage(token, session) {
    return `${PARTAGE_EXTERNE_API.url}/${token}/telecharger?session=${encodeURIComponent(session)}`
}
