<?php

namespace App\Http\Controllers;

use App\Models\AppelTelephonique;
use App\Models\Personnels;
use App\Models\Utilisateurs;
use App\Notifications\AppelRappelNotification;
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
        $appels = AppelTelephonique::with(['utilisateur.personnels', 'personnelConcerne', 'serviceMetierConcerne', 'traitePar'])
            ->orderByDesc('date_appel')
            ->orderByDesc('heure_appel')
            ->get();

        // Résolution groupée (pas un appel par ligne) des personnels_concernes_ids —
        // un simple tableau JSON, pas une vraie relation Eloquent chargeable via with().
        $tousLesIds = $appels->pluck('personnels_concernes_ids')->filter()->flatten()->unique();
        $personnelsParId = Personnels::whereIn('id', $tousLesIds)->get()->keyBy('id');
        $appels = $appels->map(function (AppelTelephonique $appel) use ($personnelsParId) {
            $appel->personnels_concernes = collect($appel->personnels_concernes_ids ?? [])
                ->map(fn ($id) => $personnelsParId->get($id))
                ->filter()
                ->values();

            return $appel;
        });

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
            'personnels_concernes_ids' => 'nullable|array',
            'personnels_concernes_ids.*' => 'integer|exists:personnels,id',
            'service_metier_concerne_id' => 'nullable|integer|exists:services_metier,id',
            'personne_concernee_texte' => 'nullable|string|max:255',
            'action' => 'required|string|in:Rappeler,Rappeler URGENT,Rappellera,Pour info',
        ]);

        $validated = $this->normaliserConcerne($validated);
        $validated['utilisateur_id'] = auth('api')->id();

        $appel = AppelTelephonique::create($validated);
        $appel->load(['utilisateur.personnels', 'personnelConcerne', 'serviceMetierConcerne']);
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
            'personnels_concernes_ids' => 'nullable|array',
            'personnels_concernes_ids.*' => 'integer|exists:personnels,id',
            'service_metier_concerne_id' => 'nullable|integer|exists:services_metier,id',
            'personne_concernee_texte' => 'nullable|string|max:255',
            'action' => 'required|string|in:Rappeler,Rappeler URGENT,Rappellera,Pour info',
        ]);

        $validated = $this->normaliserConcerne($validated);
        $appel->update($validated);
        $appel->load(['utilisateur.personnels', 'personnelConcerne', 'serviceMetierConcerne']);
        // Ne notifie que si le "concerné" (personne, plusieurs personnes ou
        // service) vient de changer — pas à chaque correction d'un appel déjà
        // rattaché aux mêmes personnes, pour ne pas les spammer. wasChanged()
        // reflète le update() qu'on vient de faire, pas le load() qui suit
        // (un load() ne déclenche pas de save, il ne peut pas l'écraser).
        if ($appel->wasChanged(['personnel_concerne_id', 'personnels_concernes_ids', 'service_metier_concerne_id'])) {
            $this->notifierPersonneConcernee($appel);
        }

        return response()->json($appel, 200);
    }

    /**
     * Les 3 façons de désigner qui est concerné (une personne, plusieurs
     * personnes, tout un service) sont mutuellement exclusives — le
     * formulaire n'en envoie qu'une à la fois (voir AppelForm.jsx), mais on
     * force ici le nettoyage des deux autres pour ne jamais garder une
     * ancienne valeur périmée après un changement de mode.
     */
    private function normaliserConcerne(array $validated): array
    {
        $validated['personnel_concerne_id'] ??= null;
        $validated['personnels_concernes_ids'] ??= null;
        $validated['service_metier_concerne_id'] ??= null;

        if ($validated['service_metier_concerne_id']) {
            $validated['personnel_concerne_id'] = null;
            $validated['personnels_concernes_ids'] = null;
        } elseif (!empty($validated['personnels_concernes_ids'])) {
            $validated['personnel_concerne_id'] = null;
            $validated['service_metier_concerne_id'] = null;
        } elseif ($validated['personnel_concerne_id']) {
            $validated['personnels_concernes_ids'] = null;
            $validated['service_metier_concerne_id'] = null;
        }

        return $validated;
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
        $appel->load(['utilisateur.personnels', 'personnelConcerne', 'serviceMetierConcerne', 'traitePar']);

        return response()->json($appel, 200);
    }

    /**
     * Seule la personne (ou l'une des personnes, ou n'importe qui du service)
     * désignée comme "concernée" par l'appel peut le modifier ou le marquer
     * traité — un administrateur (ou super administrateur) le peut toujours.
     * Si personne/service de précis n'a été désigné, on garde l'ancien
     * comportement large : n'importe qui ayant accès au registre peut agir,
     * sinon un appel non assigné deviendrait bloqué pour tout le monde sauf
     * l'administrateur.
     */
    private function autoriseAModifierOuTraiter(AppelTelephonique $appel): bool
    {
        $utilisateur = auth('api')->user();

        if ($utilisateur->estAdministrateur()) {
            return true;
        }

        if (!$appel->personnel_concerne_id && empty($appel->personnels_concernes_ids) && !$appel->service_metier_concerne_id) {
            return true;
        }

        if ($appel->personnel_concerne_id) {
            return $utilisateur->personnels()->where('id', $appel->personnel_concerne_id)->exists();
        }

        if (!empty($appel->personnels_concernes_ids)) {
            return $utilisateur->personnels()->whereIn('id', $appel->personnels_concernes_ids)->exists();
        }

        $requete = $utilisateur->roles();
        $this->roleCouvreService($requete, $appel->service_metier_concerne_id);
        return $requete->exists();
    }

    /**
     * Contrainte "ce rôle couvre ce service" — un rôle dédié
     * (service_metier_id == $serviceMetierId) OU un rôle transverse
     * (service_metier_id NULL, sauf exclut_service_metier_id == $serviceMetierId) —
     * même règle que DocumentStatusService::validateursDuService(). Sans ça,
     * un Responsable Secteur (accès transverse à tous les services sauf
     * Comptabilité/Paie, voir RoleSeeder) ne pouvait ni voir/traiter un appel
     * adressé à "tout un service", ni en être notifié — juste parce que son
     * rôle n'a pas le service_metier_id précis de ce service.
     *
     * whereHas('permissions', gerer_appels) en plus, comme
     * DocumentStatusService le fait avec valider_documents : un
     * service_metier_id NULL ne signifie "transverse à tous les services" que
     * pour un rôle réellement opérationnel (Administrateur, Responsable
     * Secteur...). Intervenant/Bénéficiaire/Viewer ont AUSSI un
     * service_metier_id NULL (ils n'appartiennent juste à aucun service), et
     * sans ce filtre se retrouvaient comptés/notifiés sur TOUS les services —
     * très visible dans les effectifs affichés, les bénéficiaires étant le
     * groupe le plus nombreux. Les rôles "Éditeur {service}" ont de toute
     * façon déjà gerer_appels (voir RoleSeeder), ce filtre ne leur retire rien.
     */
    private function roleCouvreService($query, int $serviceMetierId): void
    {
        $query->where(function ($q) use ($serviceMetierId) {
            $q->where('service_metier_id', $serviceMetierId)
                ->orWhere(function ($qTransverse) use ($serviceMetierId) {
                    $qTransverse->whereNull('service_metier_id')
                        ->where(function ($qExclu) use ($serviceMetierId) {
                            $qExclu->whereNull('exclut_service_metier_id')
                                ->orWhere('exclut_service_metier_id', '!=', $serviceMetierId);
                        });
                });
        })->whereHas('permissions', function ($q) {
            $q->where('code_perm', 'gerer_appels');
        });
    }

    /**
     * Notifie deux publics différents à la création (ou réassignation) d'un
     * appel :
     * - le(s) concerné(s) — une personne, plusieurs personnes, ou tout un
     *   service — reçoivent un message personnalisé ("Un appel vous
     *   concerne"), pour chaque compte Utilisateurs qu'on peut résoudre ;
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
        $concernesIds = $this->utilisateursConcernesIds($appel)->reject(fn ($id) => $id === $agentId);

        foreach (Utilisateurs::whereIn('id', $concernesIds)->get() as $concerne) {
            $concerne->notify(new AppelTelephoniqueNotification($appel, $appel->utilisateur->nom, estPersonneConcernee: true));
        }

        $destinataires = Utilisateurs::whereHas('roles.permissions', fn ($q) => $q->where('code_perm', 'gerer_appels'))
            ->where('id', '!=', $agentId)
            ->whereNotIn('id', $concernesIds)
            ->get();

        foreach ($destinataires as $destinataire) {
            $destinataire->notify(new AppelTelephoniqueNotification($appel, $appel->utilisateur->nom, estPersonneConcernee: false));
        }
    }

    /**
     * Comptes Utilisateurs à notifier personnellement, selon le mode
     * "concerne" choisi (une personne / plusieurs / tout un service) — voir
     * normaliserConcerne(), qui garantit qu'un seul des trois est renseigné.
     * Publique : réutilisée par RelancerAppelsEnAttente pour cibler les
     * mêmes personnes lors d'un rappel, sans dupliquer cette résolution.
     */
    public function utilisateursConcernesIds(AppelTelephonique $appel): \Illuminate\Support\Collection
    {
        if ($appel->service_metier_concerne_id) {
            return Utilisateurs::whereHas('roles', function ($q) use ($appel) {
                $this->roleCouvreService($q, $appel->service_metier_concerne_id);
            })->pluck('id');
        }

        if (!empty($appel->personnels_concernes_ids)) {
            return Personnels::whereIn('id', $appel->personnels_concernes_ids)->pluck('utilisateur_id')->filter();
        }

        if ($appel->personnel_concerne_id) {
            return Personnels::whereKey($appel->personnel_concerne_id)->pluck('utilisateur_id')->filter();
        }

        return collect();
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

    /**
     * Relance manuelle à la demande (icône cloche sur une ligne non traitée,
     * voir AppelsTelephoniques.jsx) — même esprit que DocumentController::
     * relancerCourrier(), avec la même audience que la relance automatique
     * (RelancerAppelsEnAttente) : le(s) concerné(s), sinon le reste de
     * l'équipe gerer_appels. N'attend pas les 4h, et ne touche pas
     * rappel_appel_envoye_le : la relance automatique reste indépendante.
     */
    public function relancer(AppelTelephonique $appel)
    {
        if ($appel->traite_le) {
            return response()->json(['error' => "Cet appel est déjà traité."], 422);
        }

        $agentId = $appel->utilisateur_id;
        $concernesIds = $this->utilisateursConcernesIds($appel)->reject(fn ($id) => $id === $agentId);

        $destinatairesCount = 0;
        foreach (Utilisateurs::whereIn('id', $concernesIds)->get() as $concerne) {
            $concerne->notify(new AppelRappelNotification($appel));
            $destinatairesCount++;
        }

        $destinataires = Utilisateurs::whereHas('roles.permissions', fn ($q) => $q->where('code_perm', 'gerer_appels'))
            ->where('id', '!=', $agentId)
            ->whereNotIn('id', $concernesIds)
            ->get();

        foreach ($destinataires as $destinataire) {
            $destinataire->notify(new AppelRappelNotification($appel));
            $destinatairesCount++;
        }

        return response()->json(['message' => 'Rappel envoyé', 'destinataires' => $destinatairesCount], 200);
    }
}
