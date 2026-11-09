<?php

namespace App\Http\Controllers;

use App\Jobs\RenvoyerNotificationPush;
use App\Models\PushSubscription;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Abonnements aux notifications système du navigateur (Web Push) — voir
 * WebPushChannel pour l'envoi effectif, déclenché depuis les notifications
 * existantes (App\Notifications\*), et sw.js côté front pour l'affichage.
 */
class PushSubscriptionController extends Controller
{
    /**
     * Clé publique VAPID, nécessaire au navigateur pour créer l'abonnement
     * push (PushManager.subscribe) — aucune information sensible, ouvert à
     * tout compte authentifié comme le reste de l'API.
     */
    public function vapidPublicKey()
    {
        return response()->json(['publicKey' => config('services.vapid.public_key')], 200);
    }

    /**
     * Enregistre (ou met à jour) l'abonnement du navigateur courant pour
     * l'utilisateur connecté — appelé juste après PushManager.subscribe().
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'endpoint' => 'required|string',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
            'content_encoding' => 'nullable|string',
        ]);

        PushSubscription::updateOrCreate(
            ['endpoint_hash' => hash('sha256', $validated['endpoint'])],
            [
                'utilisateur_id' => auth('api')->id(),
                'endpoint' => $validated['endpoint'],
                'public_key' => $validated['keys']['p256dh'],
                'auth_token' => $validated['keys']['auth'],
                'content_encoding' => $validated['content_encoding'] ?? 'aes128gcm',
            ]
        );

        return response()->json(['message' => 'Abonnement enregistré'], 201);
    }

    /**
     * Supprime l'abonnement (désactivation depuis les réglages, ou notification
     * "abonnement expiré" détectée par WebPushChannel côté envoi).
     */
    public function destroy(Request $request)
    {
        $validated = $request->validate([
            'endpoint' => 'required|string',
        ]);

        PushSubscription::where('endpoint_hash', hash('sha256', $validated['endpoint']))
            ->where('utilisateur_id', auth('api')->id())
            ->delete();

        return response()->json(['message' => 'Abonnement supprimé'], 200);
    }

    /**
     * Bouton « Rappeler dans 1 h » d'une notification système : appelé par
     * sw.js (sans session, d'où l'URL signée générée dans
     * WebPushChannel::envoyer()). Usage unique : la clé est retirée du cache.
     */
    public function reporter(string $cle)
    {
        $entree = Cache::pull("push_report:{$cle}");
        if (!$entree) {
            return response()->json(['message' => 'Déjà reporté ou expiré'], 410);
        }

        RenvoyerNotificationPush::dispatch($entree['utilisateur_id'], $entree['payload'])
            ->delay(now()->addHour());

        return response()->json(['message' => 'Rappel dans 1 h'], 200);
    }
}
