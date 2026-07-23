import { CREATE_PERSONNEL_API, GET_PERSONNEL_API, UPDATE_PERSONNEL_API, UPDATE_PERSONNEL_PROFILE_API } from "..";

export async function getPersonnels(){
    const {url,...meta} = GET_PERSONNEL_API;
    return await fetch(url, {...meta,credentials:'include'})
}

export async function updatePersonnels(data){
    const {url,...meta} = UPDATE_PERSONNEL_API
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}
export async function createPersonnel(data){
    const {url,...meta} = CREATE_PERSONNEL_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}

/**
 * Envoie des données de compte avec une image.
 * @param {File} image - Le fichier d'image à envoyer.
 * @returns {Promise<Response>} La réponse de la requête fetch.
 */
export async function updateProfile( file) {
    const { url, ...meta } = UPDATE_PERSONNEL_PROFILE_API;

    // Utilisation de FormData pour envoyer des données et un fichier
    const formData = new FormData();

    // Ajouter le fichier d'image au FormData
    if (file) {
        formData.append('file', file);
    }

    // Mise à jour de la méthode et des headers pour l'utilisation de FormData
    const fetchOptions = {
        ...meta,
        body: formData,
    };

    return await fetch(url, fetchOptions);
}