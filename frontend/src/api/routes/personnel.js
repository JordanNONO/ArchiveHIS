import { CREATE_PERSONNEL_API, GET_PERSONNEL_API, GET_PERSONNEL_CONNECTES_API, UPDATE_PERSONNEL_API, UPDATE_PERSONNEL_PROFILE_API, UPDATE_PERSONNEL_BY_ID_API, DELETE_PERSONNEL_BY_ID_API, REGENERER_MOT_DE_PASSE_PERSONNEL_API, DOSSIER_PERSONNE_API } from "..";

export async function getPersonnels(){
    const {url,...meta} = GET_PERSONNEL_API;
    return await fetch(url, {...meta,credentials:'include'})
}

/**
 * Comptes actuellement en ligne (activité dans les 5 dernières minutes),
 * personnel interne et comptes dépôt confondus — réservé à l'admin.
 */
export async function getPersonnelsConnectes(){
    const {url,...meta} = GET_PERSONNEL_CONNECTES_API;
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

export async function updateProfile( file) {
    const { url, ...meta } = UPDATE_PERSONNEL_PROFILE_API;

    const formData = new FormData();

    if (file) {
        formData.append('file', file);
    }

    const fetchOptions = {
        ...meta,
        body: formData,
    };

    return await fetch(url, fetchOptions);
}

/**
 * Modifie un personnel par son id (action administrateur).
 * @param {{nom?:string,prenom?:string,bureau_id?:number,role_id?:number}} data
 */
export async function updatePersonnelById(id, data){
    const {url,...meta} = UPDATE_PERSONNEL_BY_ID_API;
    return await fetch(url+`/${id}`, {...meta,body:JSON.stringify(data),credentials:'include'})
}

/**
 * Supprime un personnel par son id (action administrateur).
 */
export async function deletePersonnelById(id){
    const {url,...meta} = DELETE_PERSONNEL_BY_ID_API;
    return await fetch(url+`/${id}`, {...meta,credentials:'include'})
}

/**
 * Régénère le mot de passe d'un personnel et le lui renvoie par e-mail
 * (action administrateur) — utile quand la personne a perdu/jamais reçu
 * l'e-mail initial contenant ses identifiants.
 */
export async function regenererMotDePassePersonnel(id){
    const {url,...meta} = REGENERER_MOT_DE_PASSE_PERSONNEL_API;
    return await fetch(url+`/${id}/regenerer-mot-de-passe`, {...meta,credentials:'include'})
}

/** Dossier unique d'une personne (voir DocumentController::dossierPersonne()) — documents, appels et PAI qui la concernent, en une chronologie. */
export async function getDossierPersonne(personnelId){
    const {url,...meta} = DOSSIER_PERSONNE_API;
    return await fetch(url+`/${personnelId}/dossier`, {...meta,credentials:'include'})
}