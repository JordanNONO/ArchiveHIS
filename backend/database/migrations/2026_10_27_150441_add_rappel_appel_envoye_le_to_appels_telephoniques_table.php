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
            // Garde-fou contre un double envoi (voir RelancerAppelsEnAttente,
            // même principe que rappel_courrier_envoye_le sur document_archives).
            $table->timestamp('rappel_appel_envoye_le')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->dropColumn('rappel_appel_envoye_le');
        });
    }
};
