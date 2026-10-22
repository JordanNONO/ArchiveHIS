<?php

namespace App\Notifications;

use App\Models\AppelTelephonique;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Envoyée à la création (ou réassignation) d'un appel téléphonique — voir
 * AppelTelephoniqueController::notifierPersonneConcernee(), qui l'envoie sous
 * deux formes : un message personnalisé ("Un appel vous concerne") à la
 * personne désignée comme "concernée" (AppelTelephonique::personnel_concerne_id),
 * et un message générique ("Nouvel appel enregistré") au reste du personnel
 * ayant accès au registre. Même logique de base que DocumentSharedNotification
 * pour les documents.
 */
class AppelTelephoniqueNotification extends Notification
{
    use Queueable;

    public function __construct(
        public AppelTelephonique $appel,
        public string $agentNom,
        public bool $estPersonneConcernee = true,
    ) {
    }

    public function via($notifiable): array
    {
        return ['database', 'broadcast', WebPushChannel::class];
    }

    public function toArray($notifiable): array
    {
        $appel = $this->appel;
        $appelantNom = $appel->appelant_nom ?: 'un correspondant';
        $concerne = $this->personneConcernee();

        // Détails lisibles directement dans la notification, sans devoir
        // ouvrir le registre : qui a appelé, d'où, pourquoi, quand, reçu par qui.
        $appelant = trim($appelantNom
            . ($appel->appelant_organisation ? " ({$appel->appelant_organisation})" : ''));
        $details = array_values(array_filter([
            "Appel de {$appelant}" . ($appel->appelant_telephone ? " · {$appel->appelant_telephone}" : ''),
            $appel->objet ? "Objet : {$appel->objet}" : null,
            $appel->message ? 'Message : ' . \Illuminate\Support\Str::limit($appel->message, 140) : null,
            trim(($appel->date_appel ? 'Le ' . $appel->date_appel->format('d/m/Y') : '')
                . ($appel->heure_appel ? ' à ' . substr((string) $appel->heure_appel, 0, 5) : '')
                . " · reçu par {$this->agentNom}", ' ·'),
        ]));

        return [
            'type' => 'appel',
            // La personne concernée en titre : c'est ce qu'on cherche d'abord
            // en lisant la notification ("Mme AMRI Mouna" plutôt que
            // "Nouvel appel enregistré").
            'titre' => $concerne
                ? ($this->estPersonneConcernee ? "Pour vous — {$concerne}" : $concerne)
                : ($this->estPersonneConcernee ? 'Un appel vous concerne' : 'Nouvel appel enregistré'),
            'message' => "{$this->agentNom} a reçu un appel de {$appelantNom}"
                . ($appel->objet ? " — {$appel->objet}" : ''),
            'details' => $details,
            'personne_concernee' => $concerne,
            'lien' => "/appels?appel={$appel->id}",
            'appel_id' => $appel->id,
            // Voir DocumentSharedNotification — prévient l'agent quand la
            // personne concernée a vu qu'un appel lui était destiné. Pas pour
            // le message générique envoyé au reste du personnel (spam à
            // chaque lecture par n'importe qui).
            'expediteur_id' => $this->estPersonneConcernee ? $this->appel->utilisateur_id : null,
        ];
    }

    /**
     * Même ordre de priorité que personneConcernee() côté registre
     * (AppelsTelephoniques.jsx) : service entier, plusieurs personnes, une
     * personne, ou le nom libre saisi.
     */
    private function personneConcernee(): ?string
    {
        $appel = $this->appel;
        if ($appel->serviceMetierConcerne) {
            return 'Service ' . $appel->serviceMetierConcerne->nom_service;
        }
        if (!empty($appel->personnels_concernes_ids)) {
            $noms = $appel->personnelsConcernes()
                ->map(fn ($p) => trim(($p->prenom ?? '') . ' ' . ($p->nom ?? '')))
                ->filter()
                ->implode(', ');
            if ($noms !== '') {
                return $noms;
            }
        }
        if ($appel->personnelConcerne) {
            return trim(($appel->personnelConcerne->prenom ?? '') . ' ' . ($appel->personnelConcerne->nom ?? '')) ?: null;
        }

        return $appel->personne_concernee_texte ?: null;
    }
}
