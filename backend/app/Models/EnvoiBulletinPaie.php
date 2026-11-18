<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Une ligne par salarié et par tentative d'envoi — jamais écrasée, voir la
 * migration creer_envois_bulletins_paie_table pour le pourquoi.
 */
class EnvoiBulletinPaie extends Model
{
    use HasFactory;

    protected $table = 'envois_bulletins_paie';

    public const STATUTS = ['en_attente', 'envoye', 'echec'];

    protected $fillable = [
        'mois',
        'personnel_id',
        'document_archive_id',
        'mail_utilise',
        'statut',
        'erreur',
        'envoye_le',
        'cree_par_id',
    ];

    protected $casts = [
        'mois' => 'date',
        'envoye_le' => 'datetime',
    ];

    public function personnel()
    {
        return $this->belongsTo(Personnels::class, 'personnel_id');
    }

    public function document()
    {
        return $this->belongsTo(DocumentArchive::class, 'document_archive_id');
    }

    public function creePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'cree_par_id');
    }
}
