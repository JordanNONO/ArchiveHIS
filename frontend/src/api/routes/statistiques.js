import { STATISTIQUES_API } from "..";

/**
 * Vue d'ensemble chiffrée de l'activité documentaire (volumes, statuts, délais).
 */
export async function getStatistiques(){
    const {url,...meta} = STATISTIQUES_API;
    return await fetch(url, {...meta,credentials:'include'})
}
