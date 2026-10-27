<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Compteur dédié à la génération atomique des références de courrier (une
 * ligne par préfixe+mois, ex: "CRE-2610") — voir DocumentController::
 * genererReferenceCourrier(). Table séparée plutôt qu'un count() sur
 * document_archives : il doit toujours y avoir une ligne à verrouiller
 * (lockForUpdate()), y compris pour le tout premier courrier du mois.
 */
class CourrierCompteur extends Model
{
    protected $table = 'courrier_compteurs';

    protected $fillable = ['cle', 'valeur'];
}
