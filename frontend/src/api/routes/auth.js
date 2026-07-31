import { AUTH_UPDATE_API, INSCRIPTION_CODE_API, INSCRIPTION_VERIFIER_API, LOGIN_API, LOGOUT_API, MOT_DE_PASSE_OUBLIE_CODE_API, MOT_DE_PASSE_OUBLIE_REINITIALISER_API } from "../index";

export async function loginAPI(data) {
    const { url, ...meta } = LOGIN_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}

/**
 * Auto-inscription d'un compte intervenant/bénéficiaire, en deux temps : envoi
 * d'un code (email pour l'instant, SMS pas encore disponible), puis vérification
 * qui crée réellement le compte.
 * @param {{nom:string, prenom:string, telephone:string, email:string, password:string, type:'Intervenant'|'Beneficiaire', canal:'email'|'sms'}} data
 */
export async function envoyerCodeInscription(data) {
    const { url, ...meta } = INSCRIPTION_CODE_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function verifierInscription(email, code) {
    const { url, ...meta } = INSCRIPTION_VERIFIER_API;
    return await fetch(url, {...meta,body:JSON.stringify({ email, code }),credentials:'include'})
}

export async function updateLoginAPI(data) {
    const { url, ...meta } = AUTH_UPDATE_API;
    return await fetch(url, {...meta,body:JSON.stringify(data),credentials:'include'})
}

export async function logoutAPI(){
    const {url,...meta} = LOGOUT_API;
    return await fetch(url, {...meta,credentials:'include'})
}

/**
 * Mot de passe oublié, en deux temps comme l'inscription : envoi d'un code
 * (si un compte existe pour cet email), puis vérification qui enregistre le
 * nouveau mot de passe.
 */
export async function envoyerCodeMotDePasseOublie(email) {
    const { url, ...meta } = MOT_DE_PASSE_OUBLIE_CODE_API;
    return await fetch(url, {...meta,body:JSON.stringify({ email }),credentials:'include'})
}

export async function reinitialiserMotDePasse(email, code, password) {
    const { url, ...meta } = MOT_DE_PASSE_OUBLIE_REINITIALISER_API;
    return await fetch(url, {...meta,body:JSON.stringify({ email, code, password }),credentials:'include'})
}