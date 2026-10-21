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
        Schema::table('fluctuations_rh', function (Blueprint $table) {
            // Garde-fou contre un double envoi (voir RelancerRenouvellementEssai,
            // même principe que rappel_courrier_envoye_le sur document_archives) —
            // uniquement rempli pour une ligne "entree", une fois le rappel de
            // renouvellement de la période d'essai envoyé.
            $table->timestamp('rappel_essai_envoye_le')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('fluctuations_rh', function (Blueprint $table) {
            $table->dropColumn('rappel_essai_envoye_le');
        });
    }
};
