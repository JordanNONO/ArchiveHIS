<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    public function utilisateurs()
    {
        return $this->belongsToMany(Utilisateurs::class, 'conversation_utilisateur', 'conversation_id', 'utilisateur_id')
            ->withPivot('dernier_lu_a')
            ->withTimestamps();
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    public function dernierMessage()
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }
}
