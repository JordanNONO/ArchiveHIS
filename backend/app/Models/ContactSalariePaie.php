<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Adresse e-mail saisie à la main pour un salarié (voir la migration creer_contacts_salaries_paie_table). */
class ContactSalariePaie extends Model
{
    protected $table = 'contacts_salaries_paie';

    protected $fillable = ['cle', 'nom', 'mail', 'modifie_par_id'];
}
