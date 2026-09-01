import { GET_DOCUMENTS_API, POST_DOCUMENTS_API, SHARE_DOCUMENTS_API, FAVORITE_DOCUMENT_API, TRACK_DOCUMENTS_CONSULT_API, TRANSITION_DOCUMENT_API, RESOUDRE_COURRIER_DOCUMENT_API, HISTORIQUE_DOCUMENT_API, CONSULTATIONS_DOCUMENT_API, VERSIONS_DOCUMENT_API, NEW_VERSION_DOCUMENT_API, CORRIGER_ET_RENVOYER_DOCUMENT_API, VERIFIER_INTEGRITE_DOCUMENT_API, DOCUMENT_META_API, GET_PARTAGES_RECUS_API, UPDATE_DOCUMENTS_API, DELETE_DOCUMENTS_API, TRASH_DOCUMENTS_API, RESTORE_DOCUMENT_API, FORCE_DELETE_DOCUMENT_API, A_TRAITER_DOCUMENTS_API, COURRIER_COMPTEURS_DOCUMENTS_API, DECISION_CONGES_DOCUMENT_API, DECISION_PAIE_DOCUMENT_API, VERROUILLER_DOCUMENT_API, DEVERROUILLER_DOCUMENT_API } from "..";

/**
 * Envoie des données de compte avec une image.
 * 
 * @param {Object} data - Les données à envoyer.
 * @param {File} file - Le fichier d'image à envoyer.
 * @returns {Promise<Response>} La réponse de la requête fetch.
 */
export async function createDocument(data, file) {
    const { url, ...meta } = POST_DOCUMENTS_API;

    // Utilisation de FormData pour envoyer des données et un fichier
    const formData = new FormData();
    
    // Ajouter les données au FormData — on saute les valeurs undefined/null
    // (un champ optionnel non renseigné), sinon FormData les transforme en la
    // chaîne littérale "undefined"/"null", polluée en base côté serveur.
    for (const key in data) {
        if (data.hasOwnProperty(key) && data[key] !== undefined && data[key] !== null) {
            // Un tableau (ex: destinataires_ids) doit partir en plusieurs champs
            // "cle[]" pour que Laravel le reçoive comme un vrai tableau — un
            // simple append() le convertirait en chaîne "1,2,3" illisible côté validation.
            if (Array.isArray(data[key])) {
                data[key].forEach((valeur) => formData.append(`${key}[]`, valeur));
            } else {
                formData.append(key, data[key]);
            }
        }
    }

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

export async function getDocument(){
    const {url,...meta} = GET_DOCUMENTS_API;
    return await fetch(url, {...meta,credentials:'include'})
}

/**
 * Liens signés à durée limitée vers le fichier (affichage inline + téléchargement) —
 * show()/downloadVersion() n'acceptent plus que ces liens, pas de Bearer possible
 * sur une balise <img>/<iframe>/<a> (voir DocumentController::lienFichier()).
 */
export async function getDocumentLienFichier(id){
    const {url,...meta} = DOCUMENT_META_API;
    return await fetch(url+`/${id}/lien-fichier`, {...meta,credentials:'include'})
}

export async function getVersionLienFichier(id, versionId){
    const {url,...meta} = DOCUMENT_META_API;
    return await fetch(url+`/${id}/versions/${versionId}/lien-fichier`, {...meta,credentials:'include'})
}

export async function consultationDocument(data){
    const {url,...meta} = TRACK_DOCUMENTS_CONSULT_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}
/**
 * Partage un document avec un collègue (destinataire_utilisateur_id) ou par email
 * avec un particulier externe (email), avec un message optionnel.
 * @param {Number} id
 * @param {{destinataire_utilisateur_id?: number, email?: string, message?: string}} data
 */
export async function shareDocument(id, data){
    const {url,...meta} = SHARE_DOCUMENTS_API;
    return await fetch(url+`/${id}/share`, {...meta,body:JSON.stringify(data),credentials:'include'})
}

/**
 * Épingle/désépingle un document en favori pour l'utilisateur connecté.
 */
export async function favoriDocument(id){
    const {url,...meta} = FAVORITE_DOCUMENT_API;
    return await fetch(url+`/${id}/favorite`, {...meta,credentials:'include'})
}

export async function defavoriDocument(id){
    const {url,...meta} = FAVORITE_DOCUMENT_API;
    return await fetch(url+`/${id}/unfavorite`, {...meta,credentials:'include'})
}
export async function countDocument(){
    const {url,...meta} = GET_DOCUMENTS_API;
    return await fetch(url+'/count', {...meta,credentials:'include'})
}

/**
 * Fait transitionner un document vers un nouveau statut du workflow.
 * @param {Number} id
 * @param {{nouveau_statut: string, motif?: string}} data
 */
export async function transitionDocument(id, data){
    const {url,...meta} = TRANSITION_DOCUMENT_API;
    return await fetch(url+`/${id}/transition`, {...meta,body:JSON.stringify(data),credentials:'include'})
}

/**
 * Résout un courrier entrant (Payé/Prélèvement/Traité) et l'archive dans la
 * foulée — voir DocumentController::resoudreCourrier().
 * @param {Number} id
 * @param {{etat_courrier: string}} data
 */
export async function resoudreCourrier(id, data){
    const {url,...meta} = RESOUDRE_COURRIER_DOCUMENT_API;
    return await fetch(url+`/${id}/courrier/resoudre`, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function getDocumentHistorique(id){
    const {url,...meta} = HISTORIQUE_DOCUMENT_API;
    return await fetch(url+`/${id}/historique`, {...meta,credentials:'include'})
}

/**
 * Personnes ayant consulté le document (une entrée par utilisateur).
 */
export async function getDocumentConsultations(id){
    const {url,...meta} = CONSULTATIONS_DOCUMENT_API;
    return await fetch(url+`/${id}/consultations`, {...meta,credentials:'include'})
}

export async function verifierIntegriteDocument(id){
    const {url,...meta} = VERIFIER_INTEGRITE_DOCUMENT_API;
    return await fetch(url+`/${id}/verifier-integrite`, {...meta,credentials:'include'})
}

export async function getDocumentMeta(id){
    const {url,...meta} = DOCUMENT_META_API;
    return await fetch(url+`/${id}/meta`, {...meta,credentials:'include'})
}

/**
 * Documents récemment partagés par un collègue avec l'utilisateur connecté.
 */
export async function getPartagesRecus(limit = 6){
    const {url,...meta} = GET_PARTAGES_RECUS_API;
    return await fetch(url+`?limit=${limit}`, {...meta,credentials:'include'})
}

/**
 * Modifie les métadonnées d'un document (titre, auteur, référence, résumé, catégorie).
 * @param {Number} id
 * @param {{category_id:number, type_document_id?:number, titre:string, auteur:string, resume:string, reference:string}} data
 */
export async function updateDocument(id, data){
    const {url,...meta} = UPDATE_DOCUMENTS_API;
    return await fetch(url+`/${id}`, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function deleteDocument(id){
    const {url,...meta} = DELETE_DOCUMENTS_API;
    return await fetch(url+`/${id}`, {...meta,credentials:'include'})
}

/**
 * Documents dans la corbeille (supprimés mais pas encore purgés).
 */
export async function getTrash(){
    const {url,...meta} = TRASH_DOCUMENTS_API;
    return await fetch(url, {...meta,credentials:'include'})
}

export async function restoreDocument(id){
    const {url,...meta} = RESTORE_DOCUMENT_API;
    return await fetch(url+`/${id}/restore`, {...meta,credentials:'include'})
}

export async function forceDeleteDocument(id){
    const {url,...meta} = FORCE_DELETE_DOCUMENT_API;
    return await fetch(url+`/${id}/force`, {...meta,credentials:'include'})
}

/**
 * Anciennes versions du fichier d'un document.
 */
export async function getDocumentVersions(id){
    const {url,...meta} = VERSIONS_DOCUMENT_API;
    return await fetch(url+`/${id}/versions`, {...meta,credentials:'include'})
}

/**
 * Remplace le fichier d'un document, en conservant l'ancien comme version.
 * @param {Number} id
 * @param {File} file
 * @param {'majeure'|'mineure'} [typeVersion] - défaut 'mineure' côté serveur
 */
export async function uploadNewVersion(id, file, typeVersion){
    const {url,...meta} = NEW_VERSION_DOCUMENT_API;
    const formData = new FormData();
    formData.append('file', file);
    if (typeVersion) formData.append('type_version', typeVersion);
    return await fetch(url+`/${id}/versions`, {...meta,body:formData,credentials:'include'})
}

/**
 * Pose/relâche un verrou pessimiste sur le document, pour éviter que deux
 * personnes remplacent le même fichier en même temps.
 * @param {Number} id
 */
export async function verrouillerDocument(id){
    const {url,...meta} = VERROUILLER_DOCUMENT_API;
    return await fetch(url+`/${id}/verrouiller`, {...meta,credentials:'include'})
}

export async function deverrouillerDocument(id){
    const {url,...meta} = DEVERROUILLER_DOCUMENT_API;
    return await fetch(url+`/${id}/deverrouiller`, {...meta,credentials:'include'})
}

/**
 * Permet au déposant (intervenant/bénéficiaire) de corriger lui-même un
 * document rejeté : remplace le fichier et le renvoie directement en
 * "Soumis" pour re-validation — sans passer par les droits internes.
 * @param {Number} id
 * @param {File} file
 */
export async function corrigerEtRenvoyerDocument(id, file){
    const {url,...meta} = CORRIGER_ET_RENVOYER_DOCUMENT_API;
    const formData = new FormData();
    formData.append('file', file);
    return await fetch(url+`/${id}/corriger-et-renvoyer`, {...meta,body:formData,credentials:'include'})
}

/**
 * Enregistre la décision de l'employeur sur une demande de congés : remplace
 * le fichier par le PDF complété (section 3 incrustée côté client), fait
 * transitionner le statut, et déclenche l'envoi du PDF final par e-mail au
 * demandeur — voir DocumentController::decisionConges().
 * @param {Number} id
 * @param {FormData} formData - file, nouveau_statut, motif?, nom_signataire
 */
export async function envoyerDecisionConges(id, formData){
    const {url,...meta} = DECISION_CONGES_DOCUMENT_API;
    return await fetch(url+`/${id}/decision-conges`, {...meta,body:formData,credentials:'include'})
}

/**
 * Envoie la vraie fiche de paie en réponse à une "Demande de fiche de paie" :
 * remplace le fichier, range le document dans "Bulletin de paie" au nom du
 * salarié, et marque la demande traitée — voir DocumentController::decisionPaie().
 * @param {Number} id
 * @param {FormData} formData - file
 */
export async function envoyerDecisionPaie(id, formData){
    const {url,...meta} = DECISION_PAIE_DOCUMENT_API;
    return await fetch(url+`/${id}/decision-paie`, {...meta,body:formData,credentials:'include'})
}

/**
 * Documents à traiter bientôt : en attente de validation depuis longtemps,
 * ou proches de leur échéance de purge.
 */
export async function getDocumentsATraiter(){
    const {url,...meta} = A_TRAITER_DOCUMENTS_API;
    return await fetch(url, {...meta,credentials:'include'})
}

/**
 * Compteur des courriers entrants encore "En attente" — tuile du tableau de bord.
 */
export async function getCourrierCompteurs(){
    const {url,...meta} = COURRIER_COMPTEURS_DOCUMENTS_API;
    return await fetch(url, {...meta,credentials:'include'})
}