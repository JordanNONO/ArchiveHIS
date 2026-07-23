<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'user_id',
        'category_id',
        'titre',
        'auteur',
        'type',
        'resume',
        'taille',
        'reference',
        'status_doc',
        'file_create_date',
        'file_path',
    ];

    /**
     * Get the user that owns the document.
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }
    public function categories(){
        return $this->belongsTo(Category::class);
    }
/* 
    public function shares()
    {
        return $this->hasMany(Share::class);
    } */
    public function shares()
    {
        return $this->morphMany(Share::class, 'shareable');
    }

    public function favorites()
    {
        return $this->morphMany(Favorite::class, 'favoritable');
    }

    

    /* public function favorites()
    {
        return $this->hasMany(Favorite::class);
    } */

    /**
     * Get the category that owns the document.
     */
    public function category()
    {
        return $this->belongsTo(Category::class);
    }
}
