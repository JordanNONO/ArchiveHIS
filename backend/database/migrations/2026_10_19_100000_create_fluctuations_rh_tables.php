<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fluctuation RH — éléments variables de paie du mois (entrées, sorties,
 * absences, congés, avenants, acomptes, retenues...). Remplace le classeur
 * Google Sheets "FLUCTUATION 2025/2026" (un onglet par mois, une dizaine de
 * sections empilées les unes sous les autres).
 *
 * Une seule table de lignes pour toutes les sections plutôt qu'une table par
 * section : chaque section du tableur n'a que 3 à 5 colonnes, toujours tirées
 * du même petit vocabulaire (salarié, une ou deux dates, motif, heures,
 * montant, observations) — voir SECTIONS dans FluctuationRh pour la
 * correspondance colonne du tableur -> champ.
 *
 * fluctuations_rh_mois : un enregistrement par mois, porte le circuit
 * brouillon -> validé (RH) -> transmis (paie). Un mois qui n'est plus en
 * brouillon est figé en lecture seule tant qu'il n'a pas été rouvert.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fluctuations_rh_mois', function (Blueprint $table) {
            $table->id();
            $table->date('mois')->unique();
            $table->string('statut', 20)->default('brouillon');
            $table->timestamp('valide_le')->nullable();
            $table->foreignId('valide_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamp('transmis_le')->nullable();
            $table->foreignId('transmis_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('fluctuations_rh', function (Blueprint $table) {
            $table->id();
            $table->date('mois')->index();
            $table->string('section', 20)->index();
            $table->string('salarie');
            $table->date('date_debut')->nullable();
            $table->date('date_fin')->nullable();
            $table->string('motif')->nullable();
            $table->string('heures', 50)->nullable();
            $table->decimal('montant', 10, 2)->nullable();
            $table->text('observations')->nullable();
            $table->foreignId('utilisateur_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->foreignId('modifie_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fluctuations_rh');
        Schema::dropIfExists('fluctuations_rh_mois');
    }
};
