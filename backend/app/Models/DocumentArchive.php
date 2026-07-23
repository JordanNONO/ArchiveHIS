<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class DocumentArchive extends Model
{
    use HasFactory;

    protected $table = 'document_archives';

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'utilisateur_id',
        'categorie_id',
        'titre_document',
        'auteur',
        'format_mime',
        'resume',
        'code_reference',
        'status_doc',
        'nom_fichier_original',
        'chemin_stockage_serveur',
        'taille',
        'file_create_date',
        'date_archivage',
        'duree_conservation_annees',
        'niveau_confidentialite',
        'checksum_sha256',
    ];

    /**
     * Get the user that owns the document.
     */
    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    /**
     * Get the category that owns the document.
     */
    public function categorieDocument()
    {
        return $this->belongsTo(CategorieDocument::class, 'categorie_id');
    }

    /**
     * Composition : l'historique de statut appartient au document (supprimer le document supprime son historique).
     */
    public function historiqueStatuts()
    {
        return $this->hasMany(HistoriqueStatut::class, 'document_archive_id')->orderBy('date_changement');
    }

    public function shares()
    {
        return $this->morphMany(Share::class, 'shareable');
    }

    public function favorites()
    {
        return $this->morphMany(Favorite::class, 'favoritable');
    }

    public function lireFichier(): string
    {
        return Storage::disk('sftp')->get($this->chemin_stockage_serveur);
    }

    public function verifierIntegrite(): bool
    {
        if (!$this->checksum_sha256 || !Storage::disk('sftp')->exists($this->chemin_stockage_serveur)) {
            return false;
        }

        return hash('sha256', $this->lireFichier()) === $this->checksum_sha256;
    }
}
