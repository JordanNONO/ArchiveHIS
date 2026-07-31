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
        'service_metier_id',
    ];

    public function documentArchives()
    {
        return $this->hasMany(DocumentArchive::class, 'categorie_id');
    }

    /**
     * Service propriétaire du dossier — détermine qui voit les documents
     * confidentiels qui y sont rangés (voir DocumentController::visiblePour()).
     */
    public function serviceMetier()
    {
        return $this->belongsTo(ServiceMetier::class, 'service_metier_id');
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

    /**
     * Étapes du workflow de délais (procédure) associé à ce type de dossier,
     * dans l'ordre — voir EtapeWorkflow.
     */
    public function etapesWorkflow()
    {
        return $this->hasMany(EtapeWorkflow::class, 'categorie_document_id')->orderBy('ordre');
    }
}
