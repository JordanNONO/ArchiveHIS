import { CREATE_CATEGORIE_API, DELETE_CATEGORIE_API, GET_CATEGORIE_API, UPDATE_CATEGORIE_API, DOWNLOAD_CATEGORIE_API, FAVORITE_CATEGORIE_API, SHARE_CATEGORIE_API } from "..";

export async function getCategorie(){
    const {url,...meta} = GET_CATEGORIE_API;
    // cache: 'no-store' — un dossier/sous-dossier tout juste créé doit
    // apparaître dès le prochain rechargement de cette liste ; sans ça, un
    // intermédiaire entre le navigateur et le serveur (tunnel ngrok en dev,
    // proxy réseau...) peut resservir une réponse GET mise en cache et faire
    // "disparaître" ce qui vient d'être créé jusqu'au rechargement complet
    // de la page.
    return await fetch(url, {...meta,credentials:'include',cache:'no-store'})
}

export async function createCategorie(data){
    const {url,...meta} = CREATE_CATEGORIE_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}
/**
 * 
 * @param {Number} id 
 * @returns 
 */
export async function getCategorieById(id){
    const {url,...meta} = GET_CATEGORIE_API;
    return await fetch(url+`/${id}`, {...meta,credentials:'include',cache:'no-store'})
}

/**
 * 
 * @param {Number} id 
 * @returns 
 */
export async function deleteCategorieById(id){
    const {url,...meta} = DELETE_CATEGORIE_API;
    return await fetch(url+`/${id}`, {...meta,credentials:'include'})
}

/**
 * 
 * @param {object} data 
 * @param {Number} id 
 * @returns 
 */
export async function updateCatgory(data,id){
    const {url,...meta} =UPDATE_CATEGORIE_API
    return await fetch(url+`/${id}`,{...meta,body:JSON.stringify(data), credentials:'include'})
}

/**
 * Demande la génération en tâche de fond d'un ZIP de tous les documents de la
 * catégorie (organisé par sous-dossier) — le fichier arrive par notification.
 */
export async function downloadCategorie(id){
    const {url,...meta} = DOWNLOAD_CATEGORIE_API;
    return await fetch(url+`/${id}/download`, {...meta,credentials:'include'})
}

/**
 * Épingle/désépingle un dossier en favori pour l'utilisateur connecté.
 */
export async function favoriCategorie(id){
    const {url,...meta} = FAVORITE_CATEGORIE_API;
    return await fetch(url+`/${id}/favorite`, {...meta,credentials:'include'})
}

export async function defavoriCategorie(id){
    const {url,...meta} = FAVORITE_CATEGORIE_API;
    return await fetch(url+`/${id}/unfavorite`, {...meta,credentials:'include'})
}

/**
 * Partage tout le contenu d'un dossier avec un collègue ou un service métier —
 * contrairement au partage document par document, reste interne (pas d'email
 * externe possible pour un dossier entier).
 */
export async function shareCategorie(id, data){
    const {url,...meta} = SHARE_CATEGORIE_API;
    return await fetch(url+`/${id}/share`, {...meta,body:JSON.stringify(data),credentials:'include'})
}

/**
 * Gèle/dégèle un dossier (voir CategorieController::verrouiller) — bloque le
 * dépôt, la création de sous-dossiers, et le renommage/suppression jusqu'au
 * déverrouillage.
 */
export async function verrouillerCategorie(id){
    const {url,...meta} = FAVORITE_CATEGORIE_API;
    return await fetch(url+`/${id}/verrouiller`, {...meta,credentials:'include'})
}

export async function deverrouillerCategorie(id){
    const {url,...meta} = FAVORITE_CATEGORIE_API;
    return await fetch(url+`/${id}/deverrouiller`, {...meta,credentials:'include'})
}