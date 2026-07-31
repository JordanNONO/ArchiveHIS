<?php

// app/Models/Share.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class Share extends Model
{
    use HasFactory;

    /**
     * Durée de vie du lien d'accès externe avant qu'il ne faille repartager.
     */
    private const DUREE_LIEN_JOURS = 7;

    /**
     * Durée de validité d'un code à usage unique une fois envoyé.
     */
    private const DUREE_OTP_MINUTES = 10;

    /**
     * Durée de la session ouverte après vérification réussie du code.
     */
    private const DUREE_SESSION_MINUTES = 30;

    /**
     * Tentatives de code erronées tolérées avant de devoir redemander un lien.
     */
    private const MAX_TENTATIVES_OTP = 5;

    protected $fillable = [
        'utilisateur_id',
        'destinataire_utilisateur_id',
        'email_destinataire',
        'type_partage',
        'message',
        'service_metier_id',
        'shareable_id',
        'shareable_type',
        'permissions', // e.g., read, write, etc.
        'token',
        'lien_expire_le',
        'otp_code_hash',
        'otp_expire_le',
        'otp_tentatives',
        'otp_dernier_envoi_le',
        'session_token',
        'session_expire_le',
        'dernier_acces_le',
    ];

    protected $casts = [
        'lien_expire_le' => 'datetime',
        'otp_expire_le' => 'datetime',
        'otp_dernier_envoi_le' => 'datetime',
        'session_expire_le' => 'datetime',
        'dernier_acces_le' => 'datetime',
    ];

    public function shareable()
    {
        return $this->morphTo();
    }

    /**
     * L'utilisateur qui a effectué le partage.
     */
    public function user()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    /**
     * Le collègue destinataire, pour un partage interne (type_partage = 'interne' ou 'service').
     */
    public function destinataireUtilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'destinataire_utilisateur_id');
    }

    /**
     * Le service métier ciblé, pour une transmission de service à service (type_partage = 'service').
     */
    public function serviceMetier()
    {
        return $this->belongsTo(ServiceMetier::class, 'service_metier_id');
    }

    /**
     * Génère le lien d'accès externe (token public, valable 7 jours) — appelé à la
     * création d'un partage par email. Le token seul ne donne accès à rien : il ne
     * fait qu'identifier le partage pour demander/vérifier un code.
     */
    public function genererAccesExterne(): string
    {
        $this->token = Str::random(48);
        $this->lien_expire_le = now()->addDays(self::DUREE_LIEN_JOURS);
        $this->save();

        return $this->token;
    }

    public function lienEstValide(): bool
    {
        return $this->token && $this->lien_expire_le && now()->lt($this->lien_expire_le);
    }

    /**
     * Génère un code à 6 chiffres, ne le stocke que sous forme hachée, et le
     * retourne en clair pour être envoyé par email — c'est la seule fois où il
     * existe en clair.
     */
    public function genererOtp(): string
    {
        $code = (string) random_int(100000, 999999);

        $this->otp_code_hash = Hash::make($code);
        $this->otp_expire_le = now()->addMinutes(self::DUREE_OTP_MINUTES);
        $this->otp_tentatives = 0;
        $this->otp_dernier_envoi_le = now();
        $this->save();

        return $code;
    }

    /**
     * Un nouveau code ne peut être redemandé qu'une fois par minute, pour éviter
     * qu'on ne s'en serve pour spammer la boîte mail du destinataire.
     */
    public function peutRedemanderOtp(): bool
    {
        return !$this->otp_dernier_envoi_le || now()->diffInSeconds($this->otp_dernier_envoi_le) >= 60;
    }

    /**
     * Vérifie le code saisi ; en cas de succès ouvre une session de consultation,
     * en cas d'échec incrémente le compteur de tentatives (verrouillé au-delà du
     * seuil, il faut redemander un code).
     *
     * @return string|null null si le code est valide, sinon un motif d'échec
     *                      ('aucun_code', 'expire', 'trop_de_tentatives', 'incorrect')
     *                      pour que l'appelant renvoie un message précis à l'utilisateur.
     */
    public function verifierOtp(string $code): ?string
    {
        if (!$this->otp_code_hash) {
            return 'aucun_code';
        }

        if (!$this->otp_expire_le || now()->gt($this->otp_expire_le)) {
            return 'expire';
        }

        if ($this->otp_tentatives >= self::MAX_TENTATIVES_OTP) {
            return 'trop_de_tentatives';
        }

        if (!Hash::check($code, $this->otp_code_hash)) {
            $this->increment('otp_tentatives');
            return 'incorrect';
        }

        $this->session_token = Str::random(48);
        $this->session_expire_le = now()->addMinutes(self::DUREE_SESSION_MINUTES);
        $this->otp_code_hash = null;
        $this->otp_expire_le = null;
        $this->otp_tentatives = 0;
        $this->dernier_acces_le = now();
        $this->save();

        return null;
    }

    /**
     * Tentatives de code erronées encore autorisées avant de devoir redemander un
     * code, pour afficher "il vous reste X tentative(s)" côté interface.
     */
    public function tentativesRestantes(): int
    {
        return max(self::MAX_TENTATIVES_OTP - $this->otp_tentatives, 0);
    }

    public function sessionEstValide(?string $sessionToken): bool
    {
        return $sessionToken
            && $this->session_token
            && hash_equals($this->session_token, $sessionToken)
            && $this->session_expire_le
            && now()->lt($this->session_expire_le);
    }

    /**
     * Email partiellement masqué pour affichage avant vérification du code
     * (ex: "j***@gmail.com"), pour confirmer au destinataire qu'il est au bon
     * endroit sans exposer l'adresse complète à qui aurait deviné/intercepté le lien.
     */
    public function emailMasque(): ?string
    {
        if (!$this->email_destinataire || !str_contains($this->email_destinataire, '@')) {
            return $this->email_destinataire;
        }

        [$local, $domaine] = explode('@', $this->email_destinataire, 2);
        $visible = mb_substr($local, 0, 1);

        return $visible . str_repeat('*', max(mb_strlen($local) - 1, 3)) . '@' . $domaine;
    }
}
