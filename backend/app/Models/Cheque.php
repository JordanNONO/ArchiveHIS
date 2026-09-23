<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Une ligne du registre des chèques reçus — voir la migration
 * create_cheques_table pour le contexte (table dédiée, pas un document).
 */
class Cheque extends Model
{
    use HasFactory;

    protected $table = 'cheques';

    protected $fillable = [
        'utilisateur_id',
        'numero_bordereau_remise',
        'date_depot',
        'banque_depot',
        'date_emission',
        'numero_cheque',
        'banque_emettrice',
        'nom_emetteur',
        'nom_beneficiaire',
        'montant',
        'facture_reglee',
        'chemin_scan',
        'traite_le',
        'traite_par_id',
        'note_traitement',
    ];

    protected $casts = [
        'date_depot' => 'date',
        'date_emission' => 'date',
        'montant' => 'decimal:2',
        'traite_le' => 'datetime',
    ];

    public function utilisateur()
    {
        return $this->belongsTo(Utilisateurs::class, 'utilisateur_id');
    }

    public function traitePar()
    {
        return $this->belongsTo(Utilisateurs::class, 'traite_par_id');
    }
}
