<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

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
        $notification = auth('api')->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->json(['message' => 'Notification marquée comme lue'], 200);
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
