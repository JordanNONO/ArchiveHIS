<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApiToken extends Model
{
    protected $fillable = [
        'nom',
        'prefixe',
        'jeton_hash',
        'utilisateur_id',
        'cree_par_id',
        'dernier_utilise_le',
        'revoque_le',
    ];

    protected $casts = [
        'dernier_utilise_le' => 'datetime',
        'revoque_le' => 'datetime',
    ];

    /** Toujours masqué dans les réponses JSON — seul le hash est en base, mais mieux vaut ne jamais l'exposer. */
    protected $hidden = ['jeton_hash'];

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function creePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'cree_par_id');
    }

    public function estRevoque(): bool
    {
        return $this->revoque_le !== null;
    }
}
