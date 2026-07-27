<?php

// app/Models/Share.php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Share extends Model
{
    use HasFactory;

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
}
