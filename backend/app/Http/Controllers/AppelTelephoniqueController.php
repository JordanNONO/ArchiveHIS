<?php

namespace App\Http\Controllers;

use App\Models\AppelTelephonique;
use App\Models\Utilisateurs;
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
        if (!$this->autoriseAModifierOuTraiter($appel)) {
            return response()->json(['error' => "Cet appel est déjà assigné à quelqu'un d'autre — seule la personne concernée ou un administrateur peut le modifier."], 403);
        }

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
        if (!$this->autoriseAModifierOuTraiter($appel)) {
            return response()->json(['error' => "Cet appel est déjà assigné à quelqu'un d'autre — seule la personne concernée ou un administrateur peut le marquer traité."], 403);
        }

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
     * Seule la personne désignée comme "concernée" par l'appel (si une fiche
     * Personnels reliée à un compte Utilisateurs a été choisie) peut le
     * modifier ou le marquer traité — un administrateur le peut toujours.
     * Si personne de précis n'a été désigné (personnel_concerne_id vide, ou
     * juste un texte libre via personne_concernee_texte), on garde l'ancien
     * comportement large : n'importe qui ayant accès au registre peut agir,
     * sinon un appel non assigné deviendrait bloqué pour tout le monde sauf
     * l'administrateur.
     */
    private function autoriseAModifierOuTraiter(AppelTelephonique $appel): bool
    {
        $utilisateur = auth('api')->user();

        if ($utilisateur->roles()->where('code_role', 'ADMIN')->exists()) {
            return true;
        }

        if (!$appel->personnel_concerne_id) {
            return true;
        }

        return $utilisateur->personnels()->where('id', $appel->personnel_concerne_id)->exists();
    }

    /**
     * Notifie deux publics différents à la création (ou réassignation) d'un
     * appel :
     * - la personne désignée comme "concernée" reçoit un message personnalisé
     *   ("Un appel vous concerne"), si sa fiche Personnels est reliée à un
     *   compte Utilisateurs ;
     * - tout le reste du personnel ayant accès au registre (permission
     *   gerer_appels) reçoit un message générique, pour que l'équipe soit au
     *   courant même quand personne de précis n'est encore désigné.
     * Dans les deux cas, on exclut l'agent qui a lui-même pris l'appel
     * (inutile de se notifier soi-même) et on évite de notifier deux fois la
     * même personne.
     */
    private function notifierPersonneConcernee(AppelTelephonique $appel): void
    {
        $agentId = $appel->utilisateur_id;
        $concerne = $appel->personnelConcerne?->user;
        $concerneId = $concerne && $concerne->id !== $agentId ? $concerne->id : null;

        if ($concerneId) {
            $concerne->notify(new AppelTelephoniqueNotification($appel, $appel->utilisateur->nom, estPersonneConcernee: true));
        }

        $destinataires = Utilisateurs::whereHas('roles.permissions', fn ($q) => $q->where('code_perm', 'gerer_appels'))
            ->where('id', '!=', $agentId)
            ->when($concerneId, fn ($q) => $q->where('id', '!=', $concerneId))
            ->get();

        foreach ($destinataires as $destinataire) {
            $destinataire->notify(new AppelTelephoniqueNotification($appel, $appel->utilisateur->nom, estPersonneConcernee: false));
        }
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
