import { HABILLAGE_SAISONNIER_API } from "..";

/**
 * Réglages d'application — voir ParametreApplicationController.
 * La lecture est ouverte à tout compte connecté (le logo est le même pour
 * tout le monde) ; l'écriture est refusée côté serveur à qui n'est pas
 * Super Administrateur.
 */

export async function getHabillageSaisonnier() {
    const { url, ...meta } = HABILLAGE_SAISONNIER_API;
    return await fetch(url, { ...meta, credentials: 'include' })
}

export async function majHabillageSaisonnier(data) {
    const { url, ...meta } = HABILLAGE_SAISONNIER_API;
    return await fetch(url, { ...meta, method: 'PUT', body: JSON.stringify(data), credentials: 'include' })
}
