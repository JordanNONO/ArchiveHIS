<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Même mécanique que relance_correction_envoyee_le (voir
 * RelancerCorrectionsEnRetard) : garde-fou pour n'envoyer le rappel de
 * courrier en attente qu'une seule fois, pas à chaque passage de la
 * commande planifiée.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->timestamp('rappel_courrier_envoye_le')->nullable()->after('etat_courrier');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn('rappel_courrier_envoye_le');
        });
    }
};
