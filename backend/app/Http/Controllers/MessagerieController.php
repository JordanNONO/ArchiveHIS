<?php

namespace App\Http\Controllers;

use App\Events\MessageEnvoye;
use App\Events\MessageModifie;
use App\Events\MessageSupprime;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Utilisateurs;
use App\Notifications\NewMessageNotification;
use Illuminate\Http\Request;

/**
 * Messagerie interne entre collègues — conversations à deux, façon LinkedIn
 * (maquette validée côté produit). Réservée au personnel interne : un compte
 * dépôt (Intervenant, Bénéficiaire) n'apparaît pas dans la liste des
 * personnes joignables et ne peut pas en démarrer une — mêmes rôles exclus
 * que RechercheGlobale/AssistantChat côté frontend.
 */
class MessagerieController extends Controller
{
    private const ROLES_EXCLUS = ['Intervenant', 'Beneficiaire'];

    /** Le binding de route {conversation} ne filtre pas par participant tout seul — sans ce garde-fou, n'importe quel utilisateur authentifié pourrait lire/écrire dans la conversation de deux autres personnes en devinant son id. */
    private function autoriserParticipant(Conversation $conversation, Utilisateurs $utilisateur): void
    {
        abort_unless($conversation->utilisateurs()->where('utilisateurs.id', $utilisateur->id)->exists(), 403);
    }

    /** Modifier/supprimer son propre message seulement — être participant de la conversation ne suffit pas, encore faut-il en être l'auteur. */
    private function autoriserAuteur(Message $message, Utilisateurs $utilisateur): void
    {
        abort_unless($message->utilisateur_id === $utilisateur->id, 403);
    }

    private function formaterConversation(Conversation $conversation, Utilisateurs $moi): array
    {
        $conversation->loadMissing(['utilisateurs.personnels']);
        $autre = $conversation->utilisateurs->firstWhere('id', '!=', $moi->id);
        $monPivot = $conversation->utilisateurs->firstWhere('id', $moi->id)?->pivot;
        $derniereLecture = $monPivot?->dernier_lu_a;
        $videDepuis = $monPivot?->vide_le;

        $nonLus = $conversation->messages()
            ->where('utilisateur_id', '!=', $moi->id)
            ->when($derniereLecture, fn ($q) => $q->where('created_at', '>', $derniereLecture))
            ->when($videDepuis, fn ($q) => $q->where('created_at', '>', $videDepuis))
            ->count();

        // Pas la relation dernierMessage() (non filtrée) : après "vider la
        // discussion", l'aperçu dans la liste ne doit pas montrer un message
        // que l'utilisateur vient justement de masquer pour lui-même.
        $dernierMessageVisible = $conversation->messages()
            ->when($videDepuis, fn ($q) => $q->where('created_at', '>', $videDepuis))
            ->latest()
            ->first();

        return [
            'id' => $conversation->id,
            'autre_participant' => $autre ? [
                'id' => $autre->id,
                'nom' => $autre->nom,
                'personnels' => $autre->personnels,
            ] : null,
            'dernier_message' => $dernierMessageVisible,
            'non_lus' => $nonLus,
            'updated_at' => $conversation->updated_at,
        ];
    }

    /** Mes conversations, triées par activité récente, avec dernier message et compteur de non-lus. */
    public function conversations()
    {
        $user = auth('api')->user();

        $conversations = Conversation::whereHas('utilisateurs', fn ($q) => $q->where('utilisateurs.id', $user->id))
            ->orderByDesc('updated_at')
            ->get();

        return response()->json($conversations->map(fn ($c) => $this->formaterConversation($c, $user))->values(), 200);
    }

    /** Personnel interne joignable, pour démarrer une nouvelle conversation — mêmes rôles exclus que la messagerie elle-même. */
    public function personnes()
    {
        $user = auth('api')->user();
        $personnes = Utilisateurs::whereDoesntHave('roles', fn ($q) => $q->whereIn('nom', self::ROLES_EXCLUS))
            ->where('id', '!=', $user->id)
            ->with('personnels')
            ->orderBy('nom')
            ->get(['id', 'nom']);

        return response()->json($personnes, 200);
    }

    /** Retrouve la conversation à deux avec cette personne, ou la crée si elle n'existe pas encore. */
    public function demarrer(Request $request)
    {
        $user = auth('api')->user();
        $data = $request->validate(['destinataire_id' => 'required|integer|exists:utilisateurs,id']);

        if ((int) $data['destinataire_id'] === $user->id) {
            return response()->json(['error' => 'Impossible de démarrer une conversation avec soi-même.'], 422);
        }

        // having('utilisateurs_count', 2) à seulement 2 arguments est ambigu
        // en Laravel (contrairement à where()) — passer explicitement
        // l'opérateur évite une requête mal formée, silencieuse côté client
        // (la fenêtre de discussion ne s'ouvrait jamais, sans erreur visible).
        $conversation = Conversation::whereHas('utilisateurs', fn ($q) => $q->where('utilisateurs.id', $user->id))
            ->whereHas('utilisateurs', fn ($q) => $q->where('utilisateurs.id', $data['destinataire_id']))
            ->withCount('utilisateurs')
            ->having('utilisateurs_count', '=', 2)
            ->first();

        if (!$conversation) {
            $conversation = Conversation::create();
            $conversation->utilisateurs()->attach([$user->id, $data['destinataire_id']]);
        }

        return response()->json($this->formaterConversation($conversation, $user), 200);
    }

    public function messages(Conversation $conversation)
    {
        $user = auth('api')->user();
        $this->autoriserParticipant($conversation, $user);

        $conversation->loadMissing('utilisateurs');
        $videDepuis = $conversation->utilisateurs->firstWhere('id', $user->id)?->pivot->vide_le;

        $messages = $conversation->messages()
            ->when($videDepuis, fn ($q) => $q->where('created_at', '>', $videDepuis))
            ->with('utilisateur')
            ->orderBy('created_at')
            ->get();

        return response()->json($messages, 200);
    }

    public function envoyer(Request $request, Conversation $conversation)
    {
        $user = auth('api')->user();
        $this->autoriserParticipant($conversation, $user);

        $data = $request->validate(['contenu' => 'required|string|max:4000']);

        $message = $conversation->messages()->create([
            'utilisateur_id' => $user->id,
            'contenu' => $data['contenu'],
        ]);
        $conversation->touch();

        $destinataires = $conversation->utilisateurs()->where('utilisateurs.id', '!=', $user->id)->get();
        event(new MessageEnvoye($message, [...$destinataires->pluck('id')->all(), $user->id]));
        // Notification "officielle" (cloche, badge, Web Push) en plus de
        // l'événement léger ci-dessus — voir NewMessageNotification.php.
        foreach ($destinataires as $destinataire) {
            $destinataire->notify(new NewMessageNotification($message, $user->nom));
        }

        return response()->json($message, 201);
    }

    /** Remet le compteur de non-lus à zéro pour cette conversation (côté utilisateur courant uniquement). */
    public function marquerLu(Conversation $conversation)
    {
        $user = auth('api')->user();
        $this->autoriserParticipant($conversation, $user);

        $conversation->utilisateurs()->updateExistingPivot($user->id, ['dernier_lu_a' => now()]);

        return response()->json(['ok' => true], 200);
    }

    /** Modifie le contenu de son propre message — pas de délai limite, comme les autres textes modifiables de l'appli (pas un outil de preuve légale). */
    public function modifierMessage(Request $request, Message $message)
    {
        $user = auth('api')->user();
        $this->autoriserAuteur($message, $user);

        $data = $request->validate(['contenu' => 'required|string|max:4000']);

        $message->update(['contenu' => $data['contenu'], 'modifie_le' => now()]);

        $conversation = $message->conversation;
        $destinataires = $conversation->utilisateurs()->where('utilisateurs.id', '!=', $user->id)->pluck('utilisateurs.id')->all();
        event(new MessageModifie($message, [...$destinataires, $user->id]));

        return response()->json($message, 200);
    }

    /** Supprime son propre message (pas celui de l'autre) — suppression réelle, pas un simple masquage : un message envoyé par erreur doit pouvoir disparaître pour de vrai, des deux côtés. */
    public function supprimerMessage(Message $message)
    {
        $user = auth('api')->user();
        $this->autoriserAuteur($message, $user);

        $conversationId = $message->conversation_id;
        $conversation = $message->conversation;
        $destinataires = $conversation->utilisateurs()->where('utilisateurs.id', '!=', $user->id)->pluck('utilisateurs.id')->all();

        $message->delete();

        event(new MessageSupprime($message->id, $conversationId, [...$destinataires, $user->id]));

        return response()->json(['ok' => true], 200);
    }

    /** "Vider la discussion" ne supprime rien pour l'autre participant — ça masque juste l'historique antérieur côté utilisateur courant (voir vide_le, même logique que la Corbeille : chacun ne voit que ce qui le concerne). */
    public function viderConversation(Conversation $conversation)
    {
        $user = auth('api')->user();
        $this->autoriserParticipant($conversation, $user);

        $conversation->utilisateurs()->updateExistingPivot($user->id, ['vide_le' => now(), 'dernier_lu_a' => now()]);

        return response()->json(['ok' => true], 200);
    }
}
