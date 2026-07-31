<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Suivi d'une demande de téléchargement groupé (ZIP) d'un dossier, généré en
 * tâche de fond pour ne jamais bloquer le serveur le temps de la génération.
 */
class FolderExport extends Model
{
    use HasFactory;

    protected $fillable = [
        'utilisateur_id',
        'categorie_id',
        'type_document_id',
        'nom_personne_concernee',
        'nom_dossier',
        'statut',
        'chemin_fichier',
        'erreur',
    ];

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function categorieDocument()
    {
        return $this->belongsTo(CategorieDocument::class, 'categorie_id');
    }

    public function typeDocument()
    {
        return $this->belongsTo(TypeDocument::class, 'type_document_id');
    }
}
