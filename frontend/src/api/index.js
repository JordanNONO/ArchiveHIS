/**
 * En dev, le backend n'est plus appelé directement sur :8000 : le serveur de dev
 * React le relaie sur sa propre origine (voir config-overrides.js) — nécessaire
 * dès que ce serveur passe en HTTPS (accès caméra), sinon les appels vers un
 * :8000 en http:// seraient bloqués comme contenu mixte.
 *
 * En production, même logique : Nginx sert le frontend ET relaie /api vers
 * PHP-FPM depuis la même origine (voir le guide de déploiement) — donc
 * window.location.origin reste correct dans les deux cas. Pas de domaine en
 * dur ici : ça rendrait le build dépendant d'un nom de domaine précis au lieu
 * de marcher sur n'importe quel domaine où l'app est déployée telle quelle.
 */
export const SERVER_URL = window.location.origin;
const BASE_URL =SERVER_URL+'/api'

/**
 * Le token change au cours d'une même session (connexion, /auth/me qui le
 * renouvelle, reconnexion) : il faut le relire dans sessionStorage à chaque
 * requête plutôt que de le figer une fois au chargement du module, sinon les
 * appels continuent d'utiliser un token déjà périmé jusqu'au prochain
 * rechargement complet de la page.
 */
function authHeader() {
    return `Bearer ${sessionStorage.getItem("token")}`
}

export const LOGIN_API = {
    url: `${BASE_URL}/auth`,
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    }
}
export const LOGOUT_API = {
    url: `${BASE_URL}/auth/logout`,
    method: "POST",
    get headers() {
        return {
            "Content-Type": "application/json",
            "Authorization": authHeader()
        }
    }
}
export const AUTH_ME_API = {
    url: `${BASE_URL}/auth/me`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader()
        }
    }
}
export const AUTH_UPDATE_API = {
    url: `${BASE_URL}/auth/update`,
    method: "PUT",
    get headers() {
        return {
            "Content-Type": "application/json",
            "Authorization": authHeader()
        }
    }
}
export const GET_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader()
        }
    }
}
export const GET_PARTAGES_RECUS_API = {
    url: `${BASE_URL}/documents/partages-recus`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader()
        }
    }
}
export const MES_AUXILIAIRES_API = {
    url: `${BASE_URL}/mes-auxiliaires`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader()
        }
    }
}
export const POST_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader()
        }
    }
}
export const SHARE_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const TRACK_DOCUMENTS_CONSULT_API = {
    url: `${BASE_URL}/consultations`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const UPDATE_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "PUT",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DELETE_DOCUMENTS_API = {
    url: `${BASE_URL}/documents`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader()
        }
    }
}
export const TRASH_DOCUMENTS_API = {
    url: `${BASE_URL}/documents/trash`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const A_TRAITER_DOCUMENTS_API = {
    url: `${BASE_URL}/documents/a-traiter`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const RESTORE_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const FORCE_DELETE_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const GET_ROLE_API = {
    url: `${BASE_URL}/roles`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const GET_BUREAU_API = {
    url: `${BASE_URL}/bureaux`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const GET_PERSONNEL_API = {
    url: `${BASE_URL}/personnels`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const GET_PERSONNEL_CONNECTES_API = {
    url: `${BASE_URL}/personnels/connectes`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}


export const CREATE_BUREAU_API = {
    url: `${BASE_URL}/bureaux`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DELETE_BUREAU_API = {
    url: `${BASE_URL}/bureaux`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}

export const CREATE_PERSONNEL_API = {
    url: `${BASE_URL}/personnels`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const UPDATE_PERSONNEL_API = {
    url: `${BASE_URL}/personnels`,
    method: "PUT",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const UPDATE_PERSONNEL_PROFILE_API = {
    url: `${BASE_URL}/personnels/profile`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader()
        }
    }
}

export const GET_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const DELETE_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const UPDATE_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "PUT",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}

export const CREATE_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}

export const DOCUMENT_META_API = {
    url: `${BASE_URL}/documents`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const TRANSITION_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const HISTORIQUE_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const CONSULTATIONS_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const VERSIONS_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const NEW_VERSION_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const VERROUILLER_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DEVERROUILLER_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const CORRIGER_ET_RENVOYER_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const DECISION_CONGES_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const DECISION_PAIE_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const VERIFIER_INTEGRITE_DOCUMENT_API = {
    url: `${BASE_URL}/documents`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const CREATE_ROLE_API = {
    url: `${BASE_URL}/roles`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const UPDATE_ROLE_API = {
    url: `${BASE_URL}/roles`,
    method: "PUT",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DELETE_ROLE_API = {
    url: `${BASE_URL}/roles`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const ATTACH_ROLE_PERMISSIONS_API = {
    url: `${BASE_URL}/roles`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}

export const GET_PERMISSIONS_API = {
    url: `${BASE_URL}/permissions`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const GET_SERVICES_METIER_API = {
    url: `${BASE_URL}/services-metier`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const CREATE_SERVICE_METIER_API = {
    url: `${BASE_URL}/services-metier`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const UPDATE_SERVICE_METIER_API = {
    url: `${BASE_URL}/services-metier`,
    method: "PUT",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DELETE_SERVICE_METIER_API = {
    url: `${BASE_URL}/services-metier`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const ARCHIVES_SERVICE_METIER_API = {
    url: `${BASE_URL}/services-metier`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const GET_TYPE_DOCUMENTS_API = {
    url: `${BASE_URL}/type-documents`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const CREATE_TYPE_DOCUMENT_API = {
    url: `${BASE_URL}/type-documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const UPDATE_TYPE_DOCUMENT_API = {
    url: `${BASE_URL}/type-documents`,
    method: "PUT",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DELETE_TYPE_DOCUMENT_API = {
    url: `${BASE_URL}/type-documents`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const UPDATE_PERSONNEL_BY_ID_API = {
    url: `${BASE_URL}/personnels`,
    method: "PUT",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DELETE_PERSONNEL_BY_ID_API = {
    url: `${BASE_URL}/personnels`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const REGENERER_MOT_DE_PASSE_PERSONNEL_API = {
    url: `${BASE_URL}/personnels`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}

export const GET_NOTIFICATIONS_API = {
    url: `${BASE_URL}/notifications`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const GET_NOTIFICATIONS_UNREAD_COUNT_API = {
    url: `${BASE_URL}/notifications/unread-count`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const MARK_NOTIFICATION_READ_API = {
    url: `${BASE_URL}/notifications`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const MARK_ALL_NOTIFICATIONS_READ_API = {
    url: `${BASE_URL}/notifications/read-all`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DELETE_NOTIFICATION_API = {
    url: `${BASE_URL}/notifications`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}

export const ACTIVITE_API = {
    url: `${BASE_URL}/activite`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const STATISTIQUES_API = {
    url: `${BASE_URL}/statistiques`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const DOWNLOAD_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const FAVORITE_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const SHARE_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DOWNLOAD_TYPE_DOCUMENT_API = {
    url: `${BASE_URL}/type-documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const TELECHARGEMENTS_API = {
    url: `${BASE_URL}/telechargements`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const INSCRIPTION_CODE_API = {
    url: `${BASE_URL}/inscription/code`,
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    }
}
export const INSCRIPTION_VERIFIER_API = {
    url: `${BASE_URL}/inscription/verifier`,
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    }
}

export const MOT_DE_PASSE_OUBLIE_CODE_API = {
    url: `${BASE_URL}/mot-de-passe-oublie/code`,
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    }
}
export const MOT_DE_PASSE_OUBLIE_REINITIALISER_API = {
    url: `${BASE_URL}/mot-de-passe-oublie/reinitialiser`,
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    }
}

export const PARTAGE_EXTERNE_API = {
    url: `${BASE_URL}/partages-externes`,
    method: "GET",
    headers: {
        "Content-Type": "application/json"
    }
}

export const GET_FORMATION_API = {
    url: `${BASE_URL}/formation`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const UPDATE_FORMATION_API = {
    url: `${BASE_URL}/formation`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader()
        }
    }
}

export const GET_VAPID_PUBLIC_KEY_API = {
    url: `${BASE_URL}/push/vapid-public-key`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const CREATE_PUSH_SUBSCRIPTION_API = {
    url: `${BASE_URL}/push/subscriptions`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DELETE_PUSH_SUBSCRIPTION_API = {
    url: `${BASE_URL}/push/subscriptions`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}

export const ETAPES_WORKFLOW_CATEGORIE_API = {
    url: `${BASE_URL}/categories`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const DEMARRER_SUIVI_DELAI_API = {
    url: `${BASE_URL}/documents`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const AVANCER_SUIVI_DELAI_API = {
    url: `${BASE_URL}/suivis-delais`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const CLOTURER_SUIVI_DELAI_API = {
    url: `${BASE_URL}/suivis-delais`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}

export const GET_PAI_API = {
    url: `${BASE_URL}/pai`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const CREATE_PAI_API = {
    url: `${BASE_URL}/pai`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const UPDATE_PAI_API = {
    url: `${BASE_URL}/pai`,
    method: "PUT",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const PAI_COMPTEURS_API = {
    url: `${BASE_URL}/pai/compteurs`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const CLOTURER_PAI_API = {
    url: `${BASE_URL}/pai`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const REOUVRIR_PAI_API = {
    url: `${BASE_URL}/pai`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const CREATE_PAI_OBJECTIF_API = {
    url: `${BASE_URL}/pai`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const TOGGLE_PAI_OBJECTIF_API = {
    url: `${BASE_URL}/pai-objectifs`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const DELETE_PAI_OBJECTIF_API = {
    url: `${BASE_URL}/pai-objectifs`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const UPDATE_PAI_OBJECTIF_API = {
    url: `${BASE_URL}/pai-objectifs`,
    method: "PUT",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}

export const GET_API_TOKENS_API = {
    url: `${BASE_URL}/api-tokens`,
    method: "GET",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
export const CREATE_API_TOKEN_API = {
    url: `${BASE_URL}/api-tokens`,
    method: "POST",
    get headers() {
        return {
            "Authorization": authHeader(),
            "Content-Type": "application/json"
        }
    }
}
export const DELETE_API_TOKEN_API = {
    url: `${BASE_URL}/api-tokens`,
    method: "DELETE",
    get headers() {
        return {
            "Authorization": authHeader(),
        }
    }
}
