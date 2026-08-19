<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use Illuminate\Http\Request;

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
}
