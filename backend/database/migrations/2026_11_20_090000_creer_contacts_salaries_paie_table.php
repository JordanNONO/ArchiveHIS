<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adresses e-mail saisies à la main pour l'envoi des bulletins de paie — la
 * plupart des intervenants n'ont pas de compte dans l'application, donc pas
 * d'adresse (demande explicite 2026-11-20). Une ligne par salarié, retrouvé
 * par son nom quel que soit l'ordre des mots (`cle`, voir
 * SalariesPaie::cle()), et réutilisée chaque mois.
 *
 * Les envois peuvent désormais viser un salarié sans fiche personnel :
 * `salarie_cle`/`salarie_nom` le désignent sur la ligne de suivi
 * (personnel_id restant vide).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contacts_salaries_paie', function (Blueprint $table) {
            $table->id();
            $table->string('cle', 191)->unique();
            $table->string('nom');
            $table->string('mail', 191);
            $table->foreignId('modifie_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
        });

        Schema::table('envois_bulletins_paie', function (Blueprint $table) {
            $table->string('salarie_cle', 191)->nullable()->after('personnel_id')->index();
            $table->string('salarie_nom')->nullable()->after('salarie_cle');
        });
    }

    public function down(): void
    {
        Schema::table('envois_bulletins_paie', function (Blueprint $table) {
            $table->dropIndex(['salarie_cle']);
            $table->dropColumn(['salarie_cle', 'salarie_nom']);
        });
        Schema::dropIfExists('contacts_salaries_paie');
    }
};
