<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class DocumentArchive extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'document_archives';

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'utilisateur_id',
        'personnel_concerne_id',
        'nom_personne_concernee',
        'categorie_id',
        'type_document_id',
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

    public function typeDocument()
    {
        return $this->belongsTo(TypeDocument::class, 'type_document_id');
    }

    /**
     * Le salarié concerné par le document (ex: le titulaire d'un CV, d'un contrat...),
     * distinct de l'utilisateur qui l'a téléversé (souvent un RH). Peut être absent
     * du système (candidat non encore embauché) — voir nom_personne_concernee.
     */
    public function personnelConcerne()
    {
        return $this->belongsTo(Personnels::class, 'personnel_concerne_id');
    }

    /**
     * Nom à afficher pour la personne concernée : la fiche Personnel liée si elle
     * existe, sinon le nom libre saisi (ex: candidat sans compte).
     */
    public function getNomConcerneAttribute(): ?string
    {
        if ($this->personnelConcerne) {
            return trim("{$this->personnelConcerne->prenom} {$this->personnelConcerne->nom}");
        }

        return $this->nom_personne_concernee;
    }

    /**
     * Composition : l'historique de statut appartient au document (supprimer le document supprime son historique).
     */
    public function historiqueStatuts()
    {
        return $this->hasMany(HistoriqueStatut::class, 'document_archive_id')->orderBy('date_changement');
    }

    /**
     * Anciennes versions du fichier (avant chaque remplacement), les plus récentes
     * en premier.
     */
    public function versions()
    {
        return $this->hasMany(DocumentVersion::class, 'document_archive_id')->orderByDesc('numero_version');
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
        return Storage::disk(config('filesystems.document_disk'))->get($this->chemin_stockage_serveur);
    }

    public function verifierIntegrite(): bool
    {
        if (!$this->checksum_sha256) {
            return false;
        }

        try {
            if (!Storage::disk(config('filesystems.document_disk'))->exists($this->chemin_stockage_serveur)) {
                return false;
            }

            return hash('sha256', $this->lireFichier()) === $this->checksum_sha256;
        } catch (\Throwable $e) {
            report($e);
            return false;
        }
    }
}
