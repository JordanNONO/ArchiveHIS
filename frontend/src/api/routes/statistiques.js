import { STATISTIQUES_API } from "..";

/**
 * Vue d'ensemble chiffrée de l'activité documentaire (volumes, statuts, délais,
 * courriers, PAI, personnel, jetons API). `filtres` (vue globale uniquement) :
 * { date_debut, date_fin, service_metier_id } — mêmes clés que celles lues par
 * StatistiquesController::index(), toutes optionnelles.
 */
export async function getStatistiques(filtres = {}){
    const {url,...meta} = STATISTIQUES_API;
    const params = new URLSearchParams();
    Object.entries(filtres).forEach(([cle, valeur]) => {
        if (valeur !== undefined && valeur !== null && valeur !== '') params.append(cle, valeur);
    });
    const suffixe = params.toString();
    return await fetch(url + (suffixe ? `?${suffixe}` : ''), {...meta,credentials:'include'})
}
