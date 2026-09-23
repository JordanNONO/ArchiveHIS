<?php

namespace App\Http\Controllers;

use App\Models\Utilisateurs;
use App\Notifications\NotificationLueNotification;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    /**
     * Dernières notifications de l'utilisateur connecté (lues et non lues).
     */
    public function index(Request $request)
    {
        $notifications = auth('api')->user()
            ->notifications()
            ->latest()
            ->limit((int) $request->query('limit', 20))
            ->get();

        return response()->json($notifications, 200);
    }

    public function unreadCount()
    {
        return response()->json([
            'count' => auth('api')->user()->unreadNotifications()->count(),
        ], 200);
    }

    public function markAsRead(string $id)
    {
        $lecteur = auth('api')->user();
        $notification = $lecteur->notifications()->findOrFail($id);
        // Un seul accusé de lecture par notification — sans ce garde-fou,
        // rouvrir plusieurs fois une notification déjà lue en enverrait un
        // nouveau à chaque fois (markAsRead() est réappelable sans erreur).
        $premiereLecture = $notification->read_at === null;
        $notification->markAsRead();

        if ($premiereLecture) {
            $this->notifierExpediteurSiPertinent($notification, $lecteur);
        }

        return response()->json(['message' => 'Notification marquée comme lue'], 200);
    }

    /**
     * Accusé de lecture "rassure l'expéditeur" (voir NotificationLueNotification)
     * — seulement pour les notifications 1-vers-1 qui embarquent un
     * expediteur_id (partage de document/dossier, appel qui concerne
     * précisément quelqu'un) ; les alertes système (délai dépassé, export...)
     * n'ont personne à rassurer, et un envoi collectif (transmission à tout
     * un service) n'en porte volontairement pas, pour ne pas spammer
     * l'expéditeur à chaque lecture par chaque membre.
     */
    private function notifierExpediteurSiPertinent(DatabaseNotification $notification, Utilisateurs $lecteur): void
    {
        $expediteurId = $notification->data['expediteur_id'] ?? null;
        if (!$expediteurId || $expediteurId === $lecteur->id) {
            return;
        }

        $expediteur = Utilisateurs::find($expediteurId);
        if (!$expediteur) {
            return;
        }

        $expediteur->notify(new NotificationLueNotification(
            $lecteur->nom,
            $notification->data['titre'] ?? '',
            $notification->data['lien'] ?? null,
        ));
    }

    public function markAllAsRead()
    {
        auth('api')->user()->unreadNotifications->markAsRead();

        return response()->json(['message' => 'Toutes les notifications ont été marquées comme lues'], 200);
    }

    /**
     * Supprime une notification — scopée à l'utilisateur connecté via la
     * relation (comme markAsRead), pas d'accès possible à celle d'un autre.
     */
    public function destroy(string $id)
    {
        $notification = auth('api')->user()->notifications()->findOrFail($id);
        $notification->delete();

        return response()->json(['message' => 'Notification supprimée'], 200);
    }
}
