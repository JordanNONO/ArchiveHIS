<?php

namespace App\Notifications\Channels;

use App\Models\PushSubscription;
use App\Support\CibleNotification;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
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
 * séparée sur chacune des classes.
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

        self::envoyer($notifiable, self::construirePayload($notification->toArray($notifiable)), $abonnements);
    }

    /**
     * Nouveau modèle (maquette « Notifications HIS ») : « PRÉNOM — Action »
     * en titre, niveau d'urgence et contexte en tête du corps (une
     * notification système n'affiche que du texte), plus de quoi dessiner
     * l'avatar, les boutons, le remplacement d'une relance par la suivante
     * (tag) et le regroupement par personne dans sw.js. Sans `cible` (types
     * pas encore passés au nouveau modèle), c'est « POUR VOUS ».
     */
    public static function construirePayload(array $donnees): array
    {
        $base = rtrim((string) config('app.frontend_url'), '/');
        $absolu = fn (?string $lien) => $lien
            ? (preg_match('#^https?://#', $lien) ? $lien : $base . $lien)
            : $base;

        $cible = $donnees['cible'] ?? CibleNotification::vous();
        $titre = $donnees['titre'] ?? 'HIS Archivage';
        $entete = implode(' · ', array_filter([
            $donnees['urgence']['libelle'] ?? null,
            $donnees['contexte'] ?? null,
        ]));
        $message = $donnees['message'] ?? '';

        return [
            'title' => "{$cible['libelle']} — {$titre}",
            'titre' => $titre,
            'body' => trim($entete . ($entete !== '' && $message !== '' ? "\n" : '') . $message),
            'url' => $absolu($donnees['lien'] ?? null),
            'type' => $donnees['type'] ?? null,
            'cible' => $cible,
            'urgence' => $donnees['urgence'] ?? null,
            'persistante' => (bool) ($donnees['persistante'] ?? false),
            'tag' => $donnees['tag'] ?? null,
            'actions' => array_values(array_map(fn ($a) => [
                'action' => $a['action'],
                'title' => $a['titre'],
                'url' => isset($a['lien']) ? $absolu($a['lien']) : null,
            ], $donnees['actions'] ?? [])),
        ];
    }

    /**
     * Envoie un payload déjà construit — aussi rappelé tel quel par
     * RenvoyerNotificationPush (bouton « Rappeler dans 1 h »).
     */
    public static function envoyer($notifiable, array $payload, $abonnements = null): void
    {
        $abonnements ??= $notifiable->pushSubscriptions()->get();
        $publicKey = config('services.vapid.public_key');
        $privateKey = config('services.vapid.private_key');
        if ($abonnements->isEmpty() || !$publicKey || !$privateKey) {
            return;
        }

        // « Rappeler dans 1 h » : sw.js n'a pas de session (aucun jeton), il
        // appelle donc une URL signée qui retrouve ce payload en cache — voir
        // PushSubscriptionController::reporter().
        foreach ($payload['actions'] ?? [] as $i => $action) {
            if (($action['action'] ?? null) === 'reporter') {
                $cle = (string) Str::uuid();
                Cache::put("push_report:{$cle}", ['utilisateur_id' => $notifiable->id, 'payload' => $payload], now()->addDays(2));
                $payload['actions'][$i]['url'] = URL::temporarySignedRoute('push.reporter', now()->addDays(2), ['cle' => $cle]);
            }
        }

        $json = json_encode($payload);

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
                $json
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
