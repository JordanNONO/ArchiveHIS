<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Consultation extends Model
{
    use HasFactory;

    protected $fillable = [
        'utilisateur_id',
        'document_id',
    ];

    public function user()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function document()
    {
        return $this->belongsTo(DocumentArchive::class);
    }
}
