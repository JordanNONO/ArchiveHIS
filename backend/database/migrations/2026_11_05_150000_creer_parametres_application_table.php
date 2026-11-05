<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Réglages d'application, en clé/valeur — il n'en existait aucun jusqu'ici,
 * chaque comportement étant soit codé en dur, soit déduit d'une permission.
 *
 * Table générique plutôt qu'une colonne par réglage : le premier usage est
 * l'habillage saisonnier du logo (voir ParametreApplicationController), mais
 * un réglage suivant n'aura pas à ouvrir une migration de plus.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parametres_application', function (Blueprint $table) {
            $table->id();
            $table->string('cle', 80)->unique();
            $table->json('valeur')->nullable();
            $table->foreignId('modifie_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('parametres_application');
    }
};
