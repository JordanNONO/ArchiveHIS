<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PushSubscription extends Model
{
    protected $fillable = [
        'utilisateur_id',
        'endpoint',
        'endpoint_hash',
        'public_key',
        'auth_token',
        'content_encoding',
    ];

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }
}
