import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

window.Pusher = Pusher;

/**
 * Connexion au serveur Reverb (WebSocket auto-hébergé) pour les mises à jour en
 * temps réel — ex: deux personnes ont la même page de document ouverte, l'une
 * change le statut, l'autre le voit sans recharger. wsHost suit l'appareil qui se
 * connecte (comme SERVER_URL dans api/index.js), pour marcher aussi depuis un
 * téléphone ou un autre PC du réseau, pas seulement en local.
 */
const echo = new Echo({
    broadcaster: 'reverb',
    key: 'uvqeizginbrikgsrznt1',
    wsHost: window.location.hostname,
    wsPort: 8080,
    wssPort: 8080,
    forceTLS: false,
    enabledTransports: ['ws', 'wss'],
});

export default echo;
