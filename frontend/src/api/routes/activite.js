import { ACTIVITE_API } from "..";

/**
 * `recherche` : filtre côté serveur sur tout l'historique (voir ActiviteController).
 *
 * Fil d'activité global (changements de statut + consultations, tous documents).
 */
export async function getActivite(limit = 50, recherche = ''){
    const {url,...meta} = ACTIVITE_API;
    const params = new URLSearchParams({ limit: String(limit) });
    if (recherche.trim()) params.set('q', recherche.trim());
    return await fetch(`${url}?${params}`, {...meta,credentials:'include'})
}
