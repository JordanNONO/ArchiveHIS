<?php

namespace App\Http\Controllers;

use App\Models\AppelTelephonique;
use App\Notifications\AppelTelephoniqueNotification;
use Illuminate\Http\Request;

/**
 * Registre des appels téléphoniques — table dédiée (voir AppelTelephonique),
 * complètement indépendante des documents/courriers. Accès réservé au
 * personnel du service Administratif + Administrateur (permission
 * gerer_appels, voir routes/api.php).
 */
class AppelTelephoniqueController extends Controller
{
    /**
     * Liste complète — sert à la fois au registre et à l'autocomplétion sur
     * le nom de l'appelant côté formulaire (même principe que Courriers.jsx
     * qui réutilise sa propre liste de documents pour tout).
     */
    public function index()
    {
        $appels = AppelTelephonique::with(['utilisateur.personnels', 'personnelConcerne', 'traitePar'])
            ->orderByDesc('date_appel')
            ->orderByDesc('heure_appel')
            ->get();

        return response()->json($appels, 200);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'date_appel' => 'required|date',
            'heure_appel' => 'required|date_format:H:i',
            'appelant_nom' => 'nullable|string|max:255',
            'appelant_telephone' => 'required|string|max:50',
            'appelant_organisation' => 'nullable|string|max:255',
            'appelant_qualite' => 'nullable|string|max:255',
            'appelant_email' => 'nullable|string|max:255',
            'objet' => 'nullable|string|max:255',
            'message' => 'nullable|string',
            'oriente_nom' => 'nullable|string|max:255',
            'oriente_service' => 'nullable|string|max:255',
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'personne_concernee_texte' => 'nullable|string|max:255',
            'action' => 'required|string|in:Rappeler,Rappeler URGENT,Rappellera,Pour info',
        ]);

        $validated['utilisateur_id'] = auth('api')->id();

        $appel = AppelTelephonique::create($validated);
        $appel->load(['utilisateur.personnels', 'personnelConcerne']);
        $this->notifierPersonneConcernee($appel);

        return response()->json($appel, 201);
    }

    public function update(Request $request, AppelTelephonique $appel)
    {
        $validated = $request->validate([
            'date_appel' => 'required|date',
            'heure_appel' => 'required|date_format:H:i',
            'appelant_nom' => 'nullable|string|max:255',
            'appelant_telephone' => 'required|string|max:50',
            'appelant_organisation' => 'nullable|string|max:255',
            'appelant_qualite' => 'nullable|string|max:255',
            'appelant_email' => 'nullable|string|max:255',
            'objet' => 'nullable|string|max:255',
            'message' => 'nullable|string',
            'oriente_nom' => 'nullable|string|max:255',
            'oriente_service' => 'nullable|string|max:255',
            'personnel_concerne_id' => 'nullable|integer|exists:personnels,id',
            'personne_concernee_texte' => 'nullable|string|max:255',
            'action' => 'required|string|in:Rappeler,Rappeler URGENT,Rappellera,Pour info',
        ]);

        $appel->update($validated);
        $appel->load(['utilisateur.personnels', 'personnelConcerne']);
        // Ne notifie que si la personne concernée vient de changer (nouvel
        // assigné ou réassignation) — pas à chaque correction d'un appel déjà
        // rattaché à la même personne, pour ne pas la spammer. wasChanged()
        // reflète le update() qu'on vient de faire, pas le load() qui suit
        // (un load() ne déclenche pas de save, il ne peut pas l'écraser).
        if ($appel->wasChanged('personnel_concerne_id')) {
            $this->notifierPersonneConcernee($appel);
        }

        return response()->json($appel, 200);
    }

    public function destroy(AppelTelephonique $appel)
    {
        $appel->delete();

        return response()->json(['message' => 'Appel supprimé avec succès'], 200);
    }

    /**
     * Marque l'appel traité — avec une note libre optionnelle sur comment il
     * l'a été (ex: "Rappelé, dossier transmis à la compta"), pour la
     * traçabilité : sans elle, on sait qu'un appel a été traité mais plus
     * jamais de quoi il retournait.
     */
    public function marquerTraite(Request $request, AppelTelephonique $appel)
    {
        $validated = $request->validate([
            'note_traitement' => 'nullable|string|max:2000',
        ]);

        $appel->update([
            'traite_le' => now(),
            'traite_par_id' => auth('api')->id(),
            'note_traitement' => $validated['note_traitement'] ?? null,
        ]);
        $appel->load(['utilisateur.personnels', 'personnelConcerne', 'traitePar']);

        return response()->json($appel, 200);
    }

    /**
     * Notifie la personne désignée comme "concernée" par l'appel — seulement
     * si sa fiche Personnels est reliée à un compte Utilisateurs (une fiche
     * sans compte, ou un simple texte libre via personne_concernee_texte,
     * n'a personne à notifier) et si elle n'est pas l'agent qui a lui-même
     * pris l'appel (inutile de se notifier soi-même).
     */
    private function notifierPersonneConcernee(AppelTelephonique $appel): void
    {
        $destinataire = $appel->personnelConcerne?->user;
        if (!$destinataire || $destinataire->id === $appel->utilisateur_id) {
            return;
        }

        $destinataire->notify(new AppelTelephoniqueNotification($appel, $appel->utilisateur->nom));
    }

    /**
     * Pour la tuile "Appels à traiter" du tableau de bord (voir Home.jsx),
     * même principe que DocumentController::courrierCompteurs().
     */
    public function compteurs()
    {
        return response()->json([
            'a_traiter' => AppelTelephonique::whereNull('traite_le')->count(),
        ], 200);
    }
}
