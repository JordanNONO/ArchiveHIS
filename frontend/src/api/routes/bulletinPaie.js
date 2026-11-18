import {
    BULLETINS_PAIE_API, BULLETINS_PAIE_APERCU_ENVOI_API, BULLETINS_PAIE_ENVOYER_API, BULLETINS_PAIE_ENVOIS_API,
} from '..';

/**
 * Dépôt groupé et envoi par mail des bulletins de paie — réservé aux
 * administrateurs (voir backend/app/Http/Controllers/BulletinPaieController.php).
 */

/**
 * Dépose plusieurs bulletins d'un coup. `assignations` est un tableau
 * [{ index, personnel_id, mois }] où `index` pointe vers `fichiers[index]` —
 * les deux doivent rester synchronisés dans le même ordre.
 */
export async function deposerBulletinsPaie(fichiers, assignations) {
    const { url, ...meta } = BULLETINS_PAIE_API;
    const formData = new FormData();
    fichiers.forEach((f) => formData.append('fichiers[]', f));
    formData.append('assignations', JSON.stringify(assignations));
    return await fetch(url, { ...meta, body: formData, credentials: 'include' });
}

/** mois au format "AAAA-MM" — qui recevra le mail, qui en est exclu et pourquoi. */
export async function getApercuEnvoiBulletinsPaie(mois) {
    const { url, ...meta } = BULLETINS_PAIE_APERCU_ENVOI_API;
    return await fetch(`${url}?mois=${encodeURIComponent(mois)}`, { ...meta, credentials: 'include' });
}

/** personnelIds facultatif : restreint l'envoi à une sélection (ex: renvoyer après un échec). */
export async function envoyerBulletinsPaie(mois, personnelIds) {
    const { url, ...meta } = BULLETINS_PAIE_ENVOYER_API;
    return await fetch(url, { ...meta, body: JSON.stringify({ mois, personnel_ids: personnelIds }), credentials: 'include' });
}

/** Suivi des envois d'un mois — qui a reçu, qui a échoué et pourquoi. */
export async function getEnvoisBulletinsPaie(mois) {
    const { url, ...meta } = BULLETINS_PAIE_ENVOIS_API;
    return await fetch(`${url}?mois=${encodeURIComponent(mois)}`, { ...meta, credentials: 'include' });
}
