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
            // Rappel proactif envoyé au responsable de secteur avant l'échéance
            // (J-3) — distinct de alerte_envoyee_le, qui ne se déclenche qu'une
            // fois l'échéance dépassée. Remis à null si l'échéance est repoussée
            // (voir PaiController::updateObjectif) ou si l'objectif est décoché.
            $table->timestamp('rappel_envoye_le')->nullable()->after('alerte_envoyee_le');
            // Escalade vers l'administration si l'objectif reste en retard 7 jours
            // après la première alerte sans action du responsable de secteur —
            // mirroir de SuiviDelai::manager_notifie_le (passage au rouge).
            $table->timestamp('escalade_envoyee_le')->nullable()->after('rappel_envoye_le');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pai_objectifs', function (Blueprint $table) {
            $table->dropColumn(['rappel_envoye_le', 'escalade_envoyee_le']);
        });
    }
};
