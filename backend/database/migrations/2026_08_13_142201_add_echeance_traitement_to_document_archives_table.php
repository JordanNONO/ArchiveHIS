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
        // Échéance facultative posée à l'archivage manuel interne (voir
        // DocumentController::store()) : "ce document nécessite un traitement
        // sous N jours" — distinct de date_limite_correction, qui concerne
        // uniquement la relance d'un dépôt externe rejeté (voir
        // corrections:relancer), pas ce nouveau cas d'usage.
        Schema::table('document_archives', function (Blueprint $table) {
            $table->date('echeance_traitement_le')->nullable()->after('date_limite_correction');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn('echeance_traitement_le');
        });
    }
};
