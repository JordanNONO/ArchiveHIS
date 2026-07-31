import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { SERVER_URL } from '../api';

window.Pusher = Pusher;

/**
 * Connexion au serveur Reverb (WebSocket auto-hébergé) pour les mises à jour en
 * temps réel — ex: deux personnes ont la même page de document ouverte, l'une
 * change le statut, l'autre le voit sans recharger. wsHost suit l'appareil qui se
 * connecte (comme SERVER_URL dans api/index.js), pour marcher aussi depuis un
 * téléphone ou un autre PC du réseau, pas seulement en local.
 *
 * Le WebSocket ne se connecte plus directement à Reverb (:8080) mais à la même
 * origine que la page (relayée vers :8080 par le serveur de dev, voir
 * config-overrides.js) : une page servie en HTTPS ne peut pas ouvrir de connexion
 * ws:// non chiffrée vers un autre port (contenu mixte, bloqué par le navigateur).
 *
 * authorizer lit le token à chaque demande d'autorisation de canal privé (pas une
 * fois au chargement du module) : le token change en cours de session (connexion,
 * /auth/me qui le renouvelle) — même raison que authHeader() dans api/index.js.
 */
const port = window.location.port || (window.location.protocol === 'https:' ? 443 : 80);
const echo = new Echo({
    broadcaster: 'reverb',
    key: 'uvqeizginbrikgsrznt1',
    wsHost: window.location.hostname,
    wsPort: port,
    wssPort: port,
    forceTLS: window.location.protocol === 'https:',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel) => ({
        authorize: (socketId, callback) => {
            fetch(`${SERVER_URL}/broadcasting/auth`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${sessionStorage.getItem('token')}`,
                },
                body: JSON.stringify({ socket_id: socketId, channel_name: channel.name }),
            })
                .then((res) => (res.ok ? res.json() : Promise.reject(res)))
                .then((data) => callback(false, data))
                .catch((error) => callback(true, error));
        },
    }),
});

export default echo;
