<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EtapeWorkflow extends Model
{
    use HasFactory;

    protected $table = 'etapes_workflow';

    protected $fillable = [
        'categorie_document_id',
        'ordre',
        'nom',
        'delai_heures',
        'seuil_alerte_heures',
        'service_responsable_id',
    ];

    public function categorieDocument()
    {
        return $this->belongsTo(CategorieDocument::class, 'categorie_document_id');
    }

    public function serviceResponsable()
    {
        return $this->belongsTo(ServiceMetier::class, 'service_responsable_id');
    }

    /**
     * Étape suivante dans l'ordre de la même procédure, ou null si c'est la dernière
     * (clôture).
     */
    public function etapeSuivante(): ?self
    {
        return static::where('categorie_document_id', $this->categorie_document_id)
            ->where('ordre', '>', $this->ordre)
            ->orderBy('ordre')
            ->first();
    }
}
