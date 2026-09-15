<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Petite note libre sur COMMENT l'appel a été traité (ex: "Rappelé, dossier
 * transmis à la compta") — remplie au moment de marquer l'appel "Traité"
 * (voir AppelTelephoniqueController::marquerTraite()). Facultative : sert la
 * traçabilité sans bloquer un traitement rapide si l'agent n'a rien à
 * préciser.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->text('note_traitement')->nullable()->after('traite_par_id');
        });
    }

    public function down(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->dropColumn('note_traitement');
        });
    }
};
