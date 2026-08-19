<?php

namespace App\Notifications\Channels;

use App\Models\PushSubscription;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/**
 * Canal de notification "système" (Web Push, RFC 8291) — affiche une
 * notification au niveau du système d'exploitation (comme un antivirus, une
 * appli de messagerie...) même onglet/navigateur fermé, contrairement au
 * canal 'broadcast' existant (WebSocket, qui exige l'onglet ouvert) ou au son
 * joué depuis NotificationBell.jsx (qui exige d'être sur la page).
 *
 * Réutilise directement le toArray() de chaque notification (déjà utilisé
 * pour le canal 'database') plutôt que d'exiger une méthode toWebPush()
 * séparée sur chacune des 8 classes.
 */
class WebPushChannel
{
    public function send($notifiable, Notification $notification): void
    {
        if (!method_exists($notification, 'toArray')) {
            return;
        }

        $abonnements = $notifiable->pushSubscriptions()->get();
        if ($abonnements->isEmpty()) {
            return;
        }

        $publicKey = config('services.vapid.public_key');
        $privateKey = config('services.vapid.private_key');
        if (!$publicKey || !$privateKey) {
            return;
        }

        $donnees = $notification->toArray($notifiable);
        $lien = $donnees['lien'] ?? null;
        $url = $lien
            ? (preg_match('#^https?://#', $lien) ? $lien : rtrim(config('app.frontend_url'), '/') . $lien)
            : rtrim(config('app.frontend_url'), '/');

        $payload = json_encode([
            'title' => $donnees['titre'] ?? 'HIS Archivage',
            'body' => $donnees['message'] ?? '',
            'url' => $url,
        ]);

        $webPush = new WebPush([
            'VAPID' => [
                'subject' => config('services.vapid.subject'),
                'publicKey' => $publicKey,
                'privateKey' => $privateKey,
            ],
        ]);

        foreach ($abonnements as $abonnement) {
            $webPush->queueNotification(
                Subscription::create([
                    'endpoint' => $abonnement->endpoint,
                    'publicKey' => $abonnement->public_key,
                    'authToken' => $abonnement->auth_token,
                    'contentEncoding' => $abonnement->content_encoding ?: 'aes128gcm',
                ]),
                $payload
            );
        }

        // Une erreur ici (endpoint corrompu, clé VAPID/chiffrement invalide sur
        // cet environnement...) ne doit jamais remonter : ce canal est un
        // supplément (database + broadcast couvrent déjà la notification), pas
        // le seul chemin — une exception non rattrapée interromprait toute la
        // boucle appelante (ex: une commande planifiée qui notifie plusieurs
        // destinataires à la suite) et ferait sauter tout le monde après le
        // premier abonnement en échec.
        try {
            $rapports = $webPush->flush();
        } catch (\Throwable $e) {
            Log::warning('Envoi push échoué (exception)', ['erreur' => $e->getMessage()]);
            return;
        }

        foreach ($rapports as $rapport) {
            if ($rapport->isSuccess()) {
                continue;
            }
            // L'utilisateur a désinstallé/réinitialisé son navigateur, ou
            // révoqué la permission : l'abonnement ne servira plus jamais,
            // autant le retirer plutôt que de réessayer indéfiniment.
            if ($rapport->isSubscriptionExpired()) {
                PushSubscription::where('endpoint', $rapport->getEndpoint())->delete();
                continue;
            }
            // Tout autre échec (payload rejeté, service de push injoignable,
            // clé VAPID invalide...) était jusqu'ici totalement silencieux —
            // impossible de diagnostiquer "j'ai activé et je ne reçois rien"
            // sans savoir SI l'envoi a échoué et pourquoi.
            Log::warning('Envoi push échoué', [
                'endpoint' => $rapport->getEndpoint(),
                'raison' => $rapport->getReason(),
                'statusCode' => $rapport->getResponse()?->getStatusCode(),
                'reponse' => $rapport->getResponseContent(),
            ]);
        }
    }
}
