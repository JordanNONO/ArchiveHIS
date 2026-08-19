import { getVapidPublicKey, createPushSubscription } from '../api/routes/push';

/**
 * L'API PushManager attend la clé VAPID en Uint8Array, pas en base64 texte
 * tel que renvoyé par le serveur — conversion standard recommandée par la
 * spec Web Push (base64 URL-safe, padding "=" à compléter).
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const brut = window.atob(base64);
    return Uint8Array.from([...brut].map((c) => c.charCodeAt(0)));
}

export function pushSupporte() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * iOS/iPadOS n'expose l'API Push à Safari que pour un site ajouté à l'écran
 * d'accueil (mode standalone) — sinon `pushSupporte()` renvoie false sans
 * qu'il y ait quoi que ce soit à activer dans les réglages du navigateur.
 * Sert uniquement à adapter le message d'aide affiché (voir NotificationBell).
 */
export function estIOSSafariHorsAccueil() {
    const estIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const estStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    return estIOS && !estStandalone;
}

const DELAI_MAX_MS = 10000;

/**
 * Certains blocages réseau (proxy/pare-feu d'entreprise qui bloque les
 * serveurs Google FCM sans renvoyer d'erreur explicite) laissent
 * pushManager.subscribe() en attente indéfiniment — ni succès ni échec,
 * le bouton "Activer" resterait bloqué sur "..." pour toujours sans ce
 * garde-fou.
 */
function avecDelaiMax(promesse) {
    return Promise.race([
        promesse,
        new Promise((_, reject) => setTimeout(() => reject(new DOMException('Délai dépassé', 'TimeoutError')), DELAI_MAX_MS)),
    ]);
}

/**
 * Abonne le navigateur courant (déjà autorisé — permission déjà 'granted')
 * et envoie l'abonnement au serveur. Ne redemande jamais la permission :
 * voir demanderEtSabonner() pour ça, qui exige un geste utilisateur.
 *
 * Renvoie toujours { ok, raison } plutôt qu'un simple booléen : un échec
 * silencieux ("j'ai cliqué Activer et il ne s'est rien passé") est
 * impossible à diagnostiquer sans savoir SI ET OÙ ça a échoué — la
 * permission du navigateur peut être accordée alors que l'abonnement
 * lui-même échoue (ex: réseau d'entreprise qui bloque les serveurs Google
 * FCM utilisés par Chrome pour le push, très courant en France).
 */
async function sabonnerEtEnvoyer(registration) {
    try {
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            const res = await getVapidPublicKey();
            if (res.status !== 200) return { ok: false, raison: 'cle_vapid_indisponible' };
            const { publicKey } = await res.json();
            subscription = await avecDelaiMax(registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicKey),
            }));
        }
        const res = await createPushSubscription(subscription.toJSON());
        return res.status === 201 ? { ok: true } : { ok: false, raison: 'serveur' };
    } catch (e) {
        // AbortError/TimeoutError : le navigateur n'arrive pas à joindre son
        // service de push (souvent un pare-feu/proxy réseau qui bloque
        // Google FCM, sans le refuser explicitement — ça reste juste bloqué
        // indéfiniment) — le cas le plus fréquent en pratique, distinct d'un
        // refus de permission.
        const reseau = e.name === 'AbortError' || e.name === 'TimeoutError';
        return { ok: false, raison: reseau ? 'reseau' : 'inconnue', detail: e.message };
    }
}

/**
 * À appeler une fois par session (après connexion) : si la permission a déjà
 * été accordée par le passé, ré-enregistre discrètement l'abonnement côté
 * serveur (utile après un changement de compte, ou si le serveur avait
 * supprimé un abonnement expiré) — sans jamais afficher de popup de
 * permission, qui exige un geste utilisateur explicite dans la plupart des
 * navigateurs.
 */
export async function reabonnerSiDejaAutorise() {
    if (!pushSupporte() || Notification.permission !== 'granted') return { ok: false, raison: 'permission' };
    try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        return await sabonnerEtEnvoyer(registration);
    } catch (e) {
        return { ok: false, raison: 'inconnue', detail: e.message };
    }
}

/**
 * Demande la permission (popup navigateur) puis s'abonne — à appeler
 * uniquement depuis un clic utilisateur (bouton "Activer les notifications").
 *
 * L'ordre compte : sur Safari/iOS, le droit d'afficher le popup de permission
 * est lié au geste utilisateur (clic/tap) et disparaît dès le premier `await`
 * qui le précède — un `await navigator.serviceWorker.register(...)` avant
 * `Notification.requestPermission()` suffit à faire échouer silencieusement
 * le popup (ni accordé, ni refusé, juste jamais affiché). D'où l'appel à
 * requestPermission() en tout premier, avant tout autre await.
 */
export async function demanderEtSabonner() {
    if (!pushSupporte()) return { ok: false, raison: 'non_supporte' };
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return { ok: false, raison: 'permission' };
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        return await sabonnerEtEnvoyer(registration);
    } catch (e) {
        return { ok: false, raison: 'inconnue', detail: e.message };
    }
}
