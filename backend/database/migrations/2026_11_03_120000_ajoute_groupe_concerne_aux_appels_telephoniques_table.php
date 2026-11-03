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
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            // 4e façon de désigner les concernés, à côté d'une personne,
            // plusieurs personnes ou tout un service : un groupe transverse
            // (ex: les Responsables Secteur), voir AppelTelephonique::GROUPES.
            $table->string('groupe_concerne', 50)->nullable()->after('service_metier_concerne_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->dropColumn('groupe_concerne');
        });
    }
};
