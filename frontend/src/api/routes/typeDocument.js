import { GET_TYPE_DOCUMENTS_API, CREATE_TYPE_DOCUMENT_API, UPDATE_TYPE_DOCUMENT_API, DELETE_TYPE_DOCUMENT_API, DOWNLOAD_TYPE_DOCUMENT_API } from "..";

/**
 * Sous-catégories (types de documents), optionnellement filtrées par catégorie.
 * @param {Number} [categorieId]
 */
export async function getTypeDocuments(categorieId){
    const {url,...meta} = GET_TYPE_DOCUMENTS_API;
    const query = categorieId ? `?categorie_id=${categorieId}` : '';
    return await fetch(url+query, {...meta,credentials:'include'})
}

/**
 * Crée une nouvelle sous-catégorie (ex: un dossier par client/salarié) à
 * l'intérieur d'une catégorie.
 * @param {{categorie_id:number, libelle:string}} data
 */
export async function createTypeDocument(data){
    const {url,...meta} = CREATE_TYPE_DOCUMENT_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function updateTypeDocument(id, data){
    const {url,...meta} = UPDATE_TYPE_DOCUMENT_API;
    return await fetch(url+`/${id}`, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function deleteTypeDocument(id){
    const {url,...meta} = DELETE_TYPE_DOCUMENT_API;
    return await fetch(url+`/${id}`, {...meta,credentials:'include'})
}

/**
 * Demande la génération en tâche de fond d'un ZIP de tous les documents du
 * sous-dossier — le fichier arrive par notification.
 */
export async function downloadTypeDocument(id){
    const {url,...meta} = DOWNLOAD_TYPE_DOCUMENT_API;
    return await fetch(url+`/${id}/download`, {...meta,credentials:'include'})
}
