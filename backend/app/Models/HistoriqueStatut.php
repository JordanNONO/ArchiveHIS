<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HistoriqueStatut extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'document_archive_id',
        'utilisateur_id',
        'ancien_statut',
        'nouveau_statut',
        'date_changement',
        'motif_changement',
    ];

    public function documentArchive()
    {
        return $this->belongsTo(DocumentArchive::class);
    }

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }
}
