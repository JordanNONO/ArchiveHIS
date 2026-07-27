<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TypeDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'categorie_id',
        'libelle',
        'code',
    ];

    public function categorieDocument()
    {
        return $this->belongsTo(CategorieDocument::class, 'categorie_id');
    }

    public function documentArchives()
    {
        return $this->hasMany(DocumentArchive::class, 'type_document_id');
    }
}
