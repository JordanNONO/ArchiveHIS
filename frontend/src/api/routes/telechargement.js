import { TELECHARGEMENTS_API } from "..";

/**
 * Suivi des demandes de téléchargement groupé (ZIP) de l'utilisateur connecté.
 */
export async function getTelechargements(){
    const {url,...meta} = TELECHARGEMENTS_API;
    return await fetch(url, {...meta,credentials:'include'})
}
