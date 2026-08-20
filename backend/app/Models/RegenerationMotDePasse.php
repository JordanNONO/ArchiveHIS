<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RegenerationMotDePasse extends Model
{
    public $timestamps = false;

    protected $table = 'regenerations_mot_de_passe';

    protected $fillable = [
        'utilisateur_id',
        'regenere_par_id',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    public function utilisateur(): BelongsTo
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function regenerePar(): BelongsTo
    {
        return $this->belongsTo(Utilisateurs::class, 'regenere_par_id');
    }
}
