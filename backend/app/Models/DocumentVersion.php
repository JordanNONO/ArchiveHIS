<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * Cliché d'un fichier remplacé : conserve le fichier précédent (sur disque, à un
 * chemin distinct de la version courante) pour permettre le téléchargement d'une
 * ancienne version après le remplacement du document.
 */
class DocumentVersion extends Model
{
    use HasFactory;

    protected $fillable = [
        'document_archive_id',
        'numero_version',
        'type_version',
        'numero_majeur',
        'numero_mineur',
        'utilisateur_id',
        'nom_fichier_original',
        'chemin_stockage_serveur',
        'format_mime',
        'taille',
        'checksum_sha256',
    ];

    /**
     * "2.3" — label lisible du cliché, tel qu'il était au moment du remplacement.
     */
    public function getLabelVersionAttribute(): string
    {
        return "{$this->numero_majeur}.{$this->numero_mineur}";
    }

    public function document()
    {
        return $this->belongsTo(DocumentArchive::class, 'document_archive_id');
    }

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function lireFichier(): string
    {
        return Storage::disk(config('filesystems.document_disk'))->get($this->chemin_stockage_serveur);
    }
}
