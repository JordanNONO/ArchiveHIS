<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Délai de correction d'un document rejeté (3 jours) : le déposant doit
 * corriger et renvoyer avant cette échéance, sinon une relance est envoyée
 * (des deux côtés — déposant ET service concerné) — voir DocumentStatusService
 * et la commande planifiée corrections:relancer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->timestamp('date_limite_correction')->nullable()->after('status_doc');
            $table->timestamp('relance_correction_envoyee_le')->nullable()->after('date_limite_correction');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn(['date_limite_correction', 'relance_correction_envoyee_le']);
        });
    }
};
