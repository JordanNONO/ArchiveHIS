<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Tymon\JWTAuth\Contracts\JWTSubject;

class Utilisateurs extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable, HasApiTokens;

    protected $table = 'utilisateurs';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'nom',
        'mail',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the personnels for the user.
     */
    public function personnels()
    {
        return $this->hasMany(Personnels::class, 'utilisateur_id');
    }

    /**
     * The roles that belong to the user.
     */
    public function roles()
    {
        return $this->belongsToMany(RoleUsers::class, 'role_user', 'utilisateur_id', 'role_id');
    }

    /**
     * Abonnements aux notifications système (Web Push) — un par navigateur/
     * appareil, voir PushSubscription.
     */
    public function pushSubscriptions()
    {
        return $this->hasMany(PushSubscription::class, 'utilisateur_id');
    }

    public function hasPermission(string $codePerm): bool
    {
        return $this->roles()
            ->whereHas('permissions', fn ($query) => $query->where('code_perm', $codePerm))
            ->exists();
    }

    /**
     * Reflète la même convention que le frontend (isAdministrator) : un
     * administrateur voit tout, sans restriction de service ni de
     * confidentialité — le Super Administrateur hérite de tout ce que fait
     * un Administrator (et garde en plus la gestion des utilisateurs/rôles/
     * services métier via estSuperAdministrateur() ci-dessous).
     */
    public function estAdministrateur(): bool
    {
        return $this->roles()->whereIn('nom', ['Administrator', 'Super Administrateur'])->exists();
    }

    /**
     * Distinct d'estAdministrateur() : réservé aux quelques comptes qui
     * doivent pouvoir gérer les autres utilisateurs/rôles/permissions/
     * services métier (voir RoleSeeder.php) — un Administrateur "normal" ne
     * l'est pas forcément.
     */
    public function estSuperAdministrateur(): bool
    {
        return $this->roles()->where('nom', 'Super Administrateur')->exists();
    }

    /**
     * Le "Viewer" voit tout comme un administrateur (aucune restriction de
     * service ni de confidentialité) mais ne dispose d'aucune permission de
     * modification (création, validation, suppression, gestion...) — un
     * observateur transverse, pas un compte d'administration.
     */
    public function estViewer(): bool
    {
        return $this->roles()->where('nom', 'Viewer')->exists();
    }

    /**
     * Compte "dépôt" auto-inscrit (intervenant de terrain, bénéficiaire) — pas
     * de personnel interne. Sert notamment à simplifier le vocabulaire du
     * circuit de validation dans ce qui leur est montré/notifié (voir
     * StatutDocument::libelleExterne()).
     */
    public function estCompteDepot(): bool
    {
        return $this->roles()->whereIn('nom', ['Intervenant', 'Beneficiaire'])->exists();
    }

    /**
     * Exempté de la déconnexion automatique pour inactivité (voir
     * AuthPersonnelMiddleware et la commande inactivite:alerter) : le compte
     * fondateur (id 1, admin@sige.com — même convention que
     * UTILISATEUR_ID_ADMIN_PROTEGE dans PersonnelController.php), et les
     * comptes dépôt externes, cette règle étant réservée au personnel interne
     * (voir AlerteInactivite.jsx côté frontend, même exclusion).
     */
    public function estExempteDeconnexionAutomatique(): bool
    {
        return $this->id === 1 || $this->mail === 'admin@sige.com' || $this->estCompteDepot();
    }

    /**
     * Services métier de l'utilisateur, via ses rôles — détermine quelles catégories
     * "lui appartiennent" pour la visibilité des documents confidentiels.
     */
    public function serviceMetierIds()
    {
        return $this->roles()->pluck('service_metier_id')->filter()->unique()->values();
    }

    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims()
    {
        return [];
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            // Sans ce cast, dernier_vu_le se sérialise en JSON tel quel (chaîne
            // brute sans fuseau, ex: "2026-07-28 13:57:41") — new Date(...) côté
            // frontend l'interprète alors comme une heure LOCALE au navigateur
            // au lieu de l'heure serveur, décalant "dernière activité" de tout
            // l'écart de fuseau entre les deux (voir timeAgo() dans
            // fileTypeIcons.js). Avec le cast, Carbon sérialise en ISO 8601
            // avec le "Z"/décalage explicite, que new Date() interprète bien
            // partout.
            'dernier_vu_le' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
