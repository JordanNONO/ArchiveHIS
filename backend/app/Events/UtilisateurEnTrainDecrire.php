<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Diffusé quand quelqu'un écrit dans une conversation — purement éphémère,
 * rien n'est enregistré en base (voir MessagerieController::signalerSaisie()) :
 * si le signal se perd, l'autre personne ne verra juste pas "en train
 * d'écrire" cette fois, sans conséquence. Même canal personnel que
 * MessageEnvoye, pour la même raison (un seul abonnement déjà en place).
 */
class UtilisateurEnTrainDecrire implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    public function __construct(public int $conversationId, public int $utilisateurId, public int $destinataireId)
    {
    }

    public function broadcastOn(): array
    {
        return [new PrivateChannel('App.Models.Utilisateurs.' . $this->destinataireId)];
    }

    public function broadcastAs(): string
    {
        return 'utilisateur.saisie';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation_id' => $this->conversationId,
            'utilisateur_id' => $this->utilisateurId,
        ];
    }
}
