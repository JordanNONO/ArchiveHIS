<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CategorieDocument extends Model
{
    use HasFactory;

    protected $table = 'categorie_documents';

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'libelle_cat',
        'code',
    ];

    public function documentArchives()
    {
        return $this->hasMany(DocumentArchive::class, 'categorie_id');
    }

    public function typeDocuments()
    {
        return $this->hasMany(TypeDocument::class, 'categorie_id');
    }

    public function shares()
    {
        return $this->morphMany(Share::class, 'shareable');
    }

    public function favorites()
    {
        return $this->morphMany(Favorite::class, 'favoritable');
    }
}
