<?php

use Illuminate\Support\Facades\Broadcast;

// Canal privé standard utilisé par Laravel pour diffuser les Notifications
// (voir DocumentNeedsValidationNotification etc., via 'broadcast' dans via()) —
// le nom suit App\Models\Utilisateurs, pas le "User" par défaut du squelette
// Laravel jamais utilisé dans cette appli.
Broadcast::channel('App.Models.Utilisateurs.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Présence temps réel : qui est actuellement connecté (voir Personnel.jsx) —
// tout compte authentifié (personnel interne ou dépôt) rejoint ce canal dès
// l'ouverture de l'appli (voir MainLayout.jsx), ce qui le fait apparaître
// instantanément dans la liste des autres abonnés (join/leave), sans
// attendre le prochain sondage de PersonnelController::connectes() (gardé
// en secours si le WebSocket est coupé).
Broadcast::channel('presence-connectes', function ($user) {
    return ['id' => $user->id];
});
