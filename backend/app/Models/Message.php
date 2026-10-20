<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $fillable = ['utilisateur_id', 'contenu'];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }
}
