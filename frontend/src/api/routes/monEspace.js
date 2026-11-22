import { MON_ESPACE_API, UPDATE_DOCUMENTS_API } from "..";

/** Bulletins, documents classés au nom du salarié, échéances et solde de congés. */
export async function getMesPapiers() {
    const { url, ...meta } = MON_ESPACE_API;
    return await fetch(url + '/papiers', { ...meta, credentials: 'include' });
}

/** Tous les bulletins d'une année en un seul fichier ZIP (renvoie la réponse brute, à lire en blob). */
export async function telechargerBulletinsAnnee(annee) {
    const { url, ...meta } = MON_ESPACE_API;
    return await fetch(url + `/bulletins/zip?annee=${encodeURIComponent(annee)}`, { ...meta, credentials: 'include' });
}

/** Date de fin de validité d'un document (côté RH) — `null` la retire. */
export async function definirValiditeDocument(id, dateFinValidite) {
    const { url, ...meta } = UPDATE_DOCUMENTS_API;
    return await fetch(url + `/${id}/validite`, {
        ...meta,
        body: JSON.stringify({ date_fin_validite: dateFinValidite || null }),
        credentials: 'include',
    });
}
