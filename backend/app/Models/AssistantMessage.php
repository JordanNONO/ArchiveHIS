<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AssistantMessage extends Model
{
    protected $table = 'assistant_messages';

    protected $fillable = [
        'utilisateur_id',
        'role',
        'contenu',
        'documents',
    ];

    protected $casts = [
        'documents' => 'array',
    ];

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }
}
