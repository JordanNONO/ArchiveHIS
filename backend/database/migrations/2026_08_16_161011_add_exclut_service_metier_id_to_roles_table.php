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
        Schema::table('roles', function (Blueprint $table) {
            // Un rôle transverse (service_metier_id NULL, ex: "Responsable Secteur")
            // peut valider les documents de tous les services SAUF un seul en
            // particulier (ex: Comptabilité/Paie, réservé à un rôle dédié) — voir
            // DocumentStatusService::peutValider()/validateursDuService().
            $table->foreignId('exclut_service_metier_id')
                ->nullable()
                ->after('service_metier_id')
                ->constrained('services_metier')
                ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropForeign(['exclut_service_metier_id']);
            $table->dropColumn('exclut_service_metier_id');
        });
    }
};
