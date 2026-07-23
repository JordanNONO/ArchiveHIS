<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Consultation extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'user_id',
        'document_id',
    ];

    /**
     * Get the user that viewed the document.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the document that was viewed.
     */
    public function document()
    {
        return $this->belongsTo(Document::class);
    }
}
