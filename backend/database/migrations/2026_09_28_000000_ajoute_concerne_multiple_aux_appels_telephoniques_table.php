<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un appel peut désormais concerner plusieurs personnes ou tout un service,
 * pas seulement une personne précise (personnel_concerne_id, conservé pour
 * le mode "une personne") — voir AppelForm.jsx.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->json('personnels_concernes_ids')->nullable()->after('personnel_concerne_id');
            $table->foreignId('service_metier_concerne_id')->nullable()->after('personnels_concernes_ids')
                ->constrained('services_metier')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->dropConstrainedForeignId('service_metier_concerne_id');
            $table->dropColumn('personnels_concernes_ids');
        });
    }
};
