<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Fichier supplémentaire déposé en même temps qu'un document (ex: la lettre
 * d'un courrier + une pièce qui l'accompagnait) — distinct d'une
 * DocumentVersion, qui remplace le fichier principal plutôt que de s'y ajouter.
 */
class DocumentPieceJointe extends Model
{
    protected $fillable = [
        'document_archive_id',
        'nom_fichier_original',
        'chemin_stockage_serveur',
        'format_mime',
        'taille',
    ];

    public function document()
    {
        return $this->belongsTo(DocumentArchive::class, 'document_archive_id');
    }
}
