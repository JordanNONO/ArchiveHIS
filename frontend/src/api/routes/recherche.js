import { RECHERCHE_GLOBALE_API } from "..";

/**
 * Recherche globale (Ctrl/Cmd+K, voir RechercheGlobale.jsx) — personnel,
 * documents, courriers, appels, chèques, PAI en une seule requête.
 */
export async function rechercherGlobalement(q) {
    const { url, ...meta } = RECHERCHE_GLOBALE_API;
    return await fetch(url + `?q=${encodeURIComponent(q)}`, { ...meta, credentials: 'include' })
}
