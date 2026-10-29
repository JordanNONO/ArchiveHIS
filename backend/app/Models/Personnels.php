<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Personnels extends Model
{
    use HasFactory;

    protected $table = "personnels";
    protected $fillable = [
        'bureau_id',
        'utilisateur_id',
        'nom',
        'prenom',
        'sexe',
        'date_naissance',
        'lieu_naissance',
        'statut_mat',
        'lieu_residence',
        'first_phone',
        'second_phone',
        'cni',
        'photo',
        'lang',
        'bibliographie',
        'nb_enfant',
    ];

    public function bureau(): BelongsTo
    {
        return $this->belongsTo(Bureaux::class);
    }

    public function user()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }
}
