import { ANNONCES_PAIE_API } from "..";

/**
 * Annonces à la paie du mois (changement de RIB, d'adresse, de situation
 * familiale, de mutuelle, information générale) — voir AnnoncesPaie.jsx et
 * le contrôleur AnnoncePaieController côté serveur.
 */

/**
 * Le justificatif étant facultatif, on ne bascule en FormData que s'il y en
 * a un — même principe que createCheque(). `donnees` est un petit objet
 * (ancienne/nouvelle valeur) : en multipart il part en `donnees[cle]`,
 * notation que Laravel relit comme un tableau.
 */
function corps(data, fichier, headers) {
    if (!fichier) {
        return { headers, body: JSON.stringify(data) };
    }

    const formData = new FormData();
    for (const cle in data) {
        const valeur = data[cle];
        if (valeur === undefined || valeur === null) continue;
        if (cle === 'donnees' && typeof valeur === 'object') {
            for (const sousCle in valeur) {
                if (valeur[sousCle]) formData.append(`donnees[${sousCle}]`, valeur[sousCle]);
            }
            continue;
        }
        formData.append(cle, typeof valeur === 'boolean' ? (valeur ? '1' : '0') : valeur);
    }
    formData.append('piece_jointe', fichier);

    const { "Content-Type": _sansContentType, ...headersSansJson } = headers;
    return { headers: headersSansJson, body: formData };
}

export async function getAnnoncesPaie(mois) {
    const { url, ...meta } = ANNONCES_PAIE_API;
    return await fetch(`${url}?mois=${encodeURIComponent(mois)}`, { ...meta, credentials: 'include' })
}

export async function createAnnoncePaie(data, fichier) {
    const { url, headers, ...meta } = ANNONCES_PAIE_API;
    return await fetch(url, { ...meta, method: 'POST', ...corps(data, fichier, headers), credentials: 'include' })
}

/** POST et non PUT : PHP ne lit pas le multipart d'une requête PUT. */
export async function updateAnnoncePaie(id, data, fichier) {
    const { url, headers, ...meta } = ANNONCES_PAIE_API;
    return await fetch(`${url}/${id}`, { ...meta, method: 'POST', ...corps(data, fichier, headers), credentials: 'include' })
}

export async function changerStatutAnnoncePaie(id, statut) {
    const { url, headers, ...meta } = ANNONCES_PAIE_API;
    return await fetch(`${url}/${id}/statut`, { ...meta, method: 'POST', headers, body: JSON.stringify({ statut }), credentials: 'include' })
}

export async function deleteAnnoncePaie(id) {
    const { url, ...meta } = ANNONCES_PAIE_API;
    return await fetch(`${url}/${id}`, { ...meta, method: 'DELETE', credentials: 'include' })
}

/** Adresse d'affichage du justificatif (ouverte dans un nouvel onglet). */
export function urlPieceAnnoncePaie(id) {
    return `${ANNONCES_PAIE_API.url}/${id}/piece`;
}
