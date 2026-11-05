<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HistoriqueStatut extends Model
{
    use HasFactory;

    protected $fillable = [
        'document_archive_id',
        'utilisateur_id',
        // 'statut' (changement de statut) ou 'renommage' — voir la migration
        // ajoute_type_evenement_a_historique_statuts_table.
        'type_evenement',
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
