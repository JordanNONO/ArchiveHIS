<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('pai_objectifs', function (Blueprint $table) {
            // Évite de renotifier en boucle (toutes les 15 min) pour le même
            // objectif déjà signalé en retard — remis à null si l'objectif est
            // décoché après coup, pour ré-alerter s'il retombe en retard.
            $table->timestamp('alerte_envoyee_le')->nullable()->after('realise_par_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pai_objectifs', function (Blueprint $table) {
            $table->dropColumn('alerte_envoyee_le');
        });
    }
};
