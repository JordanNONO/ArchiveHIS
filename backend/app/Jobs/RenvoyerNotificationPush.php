<?php

namespace App\Jobs;

use App\Models\Utilisateurs;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Bouton « Rappeler dans 1 h » d'une notification système (voir sw.js et
 * PushSubscriptionController::reporter()) : renvoie la même notification,
 * avec le même tag, une heure plus tard — via la file d'attente (queue:work,
 * comme les exports ZIP).
 */
class RenvoyerNotificationPush implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $utilisateurId, public array $payload)
    {
    }

    public function handle(): void
    {
        $utilisateur = Utilisateurs::find($this->utilisateurId);
        if (!$utilisateur) {
            return;
        }

        WebPushChannel::envoyer($utilisateur, $this->payload);
    }
}
