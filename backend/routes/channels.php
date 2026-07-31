<?php

use Illuminate\Support\Facades\Broadcast;

// Canal privé standard utilisé par Laravel pour diffuser les Notifications
// (voir DocumentNeedsValidationNotification etc., via 'broadcast' dans via()) —
// le nom suit App\Models\Utilisateurs, pas le "User" par défaut du squelette
// Laravel jamais utilisé dans cette appli.
Broadcast::channel('App.Models.Utilisateurs.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
