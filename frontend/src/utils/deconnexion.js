import { logoutAPI } from '../api/routes/auth';
import { detacherAbonnementDuCompte } from './pushNotifications';

/**
 * La déconnexion locale doit toujours réussir, même si l'appel serveur
 * échoue (ex. jeton déjà expiré) — sinon un clic peut sembler ne rien faire.
 * Ce PC ne doit plus recevoir les notifications de ce compte.
 */
export function deconnecter(navigate) {
    return detacherAbonnementDuCompte()
        .then(() => logoutAPI())
        .catch(() => {})
        .finally(() => {
            sessionStorage.clear();
            navigate('/login');
        });
}
