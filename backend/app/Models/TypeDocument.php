<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TypeDocument extends Model
{
    use HasFactory;

    protected $fillable = [
        'categorie_id',
        'parent_id',
        'libelle',
        'libelle_en',
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

    /** Sous-dossier parent (imbrication façon explorateur de fichiers) — null = racine de la catégorie. */
    public function parent()
    {
        return $this->belongsTo(TypeDocument::class, 'parent_id');
    }

    /** Sous-dossiers imbriqués directement sous celui-ci. */
    public function enfants()
    {
        return $this->hasMany(TypeDocument::class, 'parent_id');
    }
}
