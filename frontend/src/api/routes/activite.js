import { ACTIVITE_API } from "..";

/**
 * Fil d'activité global (changements de statut + consultations, tous documents).
 */
export async function getActivite(limit = 50){
    const {url,...meta} = ACTIVITE_API;
    return await fetch(url+`?limit=${limit}`, {...meta,credentials:'include'})
}
