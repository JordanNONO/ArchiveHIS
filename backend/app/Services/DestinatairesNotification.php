<?php

namespace App\Services;

use App\Http\Controllers\AppelTelephoniqueController;
use App\Models\AppelTelephonique;
use App\Models\DocumentArchive;
use App\Models\ServiceMetier;
use App\Models\Utilisateurs;
use Closure;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;

/**
 * Point de passage UNIQUE pour savoir « qui reçoit quoi ». Les règles sont
 * dans config/notifications_destinataires.php (une ligne par type) ; ici on
 * ne fait que résoudre les six publics en comptes Utilisateurs, dédoublonner
 * et envoyer.
 *
 * Chaque appelant fournit un « contexte » : pour chaque public qui dépend de
 * l'objet (concernés, auteur, service, valideurs), la liste des ids — ou une
 * fonction qui la calcule, appelée seulement si la règle en a besoin. Les
 * publics « admins » et « equipe_appels » se résolvent tout seuls.
 */
class DestinatairesNotification
{
    public const PUBLICS = [
        'concernes' => 'Concernés',
        'auteur' => 'Auteur',
        'service' => 'Service',
        'valideurs' => 'Valideurs',
        'admins' => 'Admins',
        'equipe_appels' => 'Équipe appels',
    ];

    public function regle(string $type): array
    {
        $regle = config("notifications_destinataires.{$type}");
        if (!$regle) {
            throw new \InvalidArgumentException("Aucune règle de destinataires pour le type « {$type} » (voir config/notifications_destinataires.php).");
        }

        return $regle + ['publics' => [], 'secours' => []];
    }

    /**
     * Destinataires d'un type de notification : collection de
     * ['utilisateur' => Utilisateurs, 'public' => le premier public de la
     * règle qui l'a désigné]. Chaque compte n'apparaît qu'une fois.
     */
    public function resoudre(string $type, array $contexte, array $exclusIds = []): Collection
    {
        $regle = $this->regle($type);
        $exclus = collect($exclusIds)->filter()->map(fn ($id) => (int) $id);

        $parPublic = $this->idsParPublic($regle['publics'], $contexte, $exclus);
        if ($parPublic->flatten()->isEmpty() && !empty($regle['secours'])) {
            $parPublic = $this->idsParPublic($regle['secours'], $contexte, $exclus);
        }

        // Premier public gagnant : « concerné » prime sur « équipe appels »,
        // dans l'ordre où la règle les liste.
        $publicDe = [];
        foreach ($parPublic as $public => $ids) {
            foreach ($ids as $id) {
                $publicDe[$id] ??= $public;
            }
        }
        if (empty($publicDe)) {
            return collect();
        }

        return Utilisateurs::whereIn('id', array_keys($publicDe))->get()
            ->map(fn (Utilisateurs $u) => ['utilisateur' => $u, 'public' => $publicDe[$u->id]])
            ->values();
    }

    /**
     * Résout puis envoie. `$fabrique(Utilisateurs $u, string $public)` rend
     * la notification à envoyer à ce destinataire (le public permet d'adapter
     * le texte, ex. « Un appel pour vous » pour un concerné). Rend le nombre
     * de destinataires.
     */
    public function envoyer(string $type, array $contexte, Closure $fabrique, array $exclusIds = []): int
    {
        $destinataires = $this->resoudre($type, $contexte, $exclusIds);
        foreach ($destinataires as $d) {
            /** @var Notification $notification */
            $notification = $fabrique($d['utilisateur'], $d['public']);
            $d['utilisateur']->notify($notification);
        }

        return $destinataires->count();
    }

    private function idsParPublic(array $publics, array $contexte, Collection $exclus): Collection
    {
        return collect($publics)->mapWithKeys(function (string $public) use ($contexte, $exclus) {
            $ids = match ($public) {
                'admins' => $this->idsAdmins(),
                'equipe_appels' => Utilisateurs::whereHas('roles.permissions', fn ($q) => $q->where('code_perm', 'gerer_appels'))->pluck('id'),
                default => $this->depuisContexte($contexte[$public] ?? null),
            };

            return [$public => collect($ids)->filter()->map(fn ($id) => (int) $id)->unique()->diff($exclus)->values()];
        });
    }

    private function depuisContexte($valeur): iterable
    {
        if ($valeur instanceof Closure) {
            $valeur = $valeur();
        }
        if ($valeur instanceof Collection && $valeur->first() instanceof Utilisateurs) {
            return $valeur->pluck('id');
        }

        return $valeur ?? [];
    }

    // ---------------------------------------------------------------------
    // Contextes prêts à l'emploi
    // ---------------------------------------------------------------------

    public function contexteAppel(AppelTelephonique $appel): array
    {
        return [
            'concernes' => fn () => app(AppelTelephoniqueController::class)->utilisateursConcernesIds($appel),
            'auteur' => [$appel->utilisateur_id],
        ];
    }

    public function contexteDocument(DocumentArchive $document): array
    {
        return [
            'auteur' => [$document->utilisateur_id],
            'valideurs' => fn () => app(DocumentStatusService::class)->validateursDuService($document)->pluck('id'),
            'service' => fn () => $this->idsMembresService($document->categorieDocument?->service_metier_id),
        ];
    }

    /** Courriers : gérés au quotidien par le service Administratif. */
    public function contexteCourrier(DocumentArchive $document): array
    {
        return [
            'auteur' => [$document->utilisateur_id],
            'service' => fn () => $this->idsMembresService(ServiceMetier::where('code_service', 'ADMINISTRATIF')->value('id')),
        ];
    }

    public function idsAdmins(): Collection
    {
        return Utilisateurs::whereHas('roles', fn ($q) => $q->whereIn('nom', ['Administrator', 'Super Administrateur']))->pluck('id');
    }

    public function idsMembresService(?int $serviceMetierId): Collection
    {
        if (!$serviceMetierId) {
            return collect();
        }

        return Utilisateurs::whereHas('roles', fn ($q) => $q->where('service_metier_id', $serviceMetierId))->pluck('id');
    }
}
