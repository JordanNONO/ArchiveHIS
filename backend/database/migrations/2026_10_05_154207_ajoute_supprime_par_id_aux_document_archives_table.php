<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Trace QUI a envoyé le document à la corbeille (deleted_at trace deja
 * QUAND, mais pas QUI) - voir DocumentController::trash(), desormais
 * restreinte a ses propres suppressions plutot qu'a tout ce que
 * l'utilisateur peut voir (sauf pour un administrateur, qui garde tout,
 * pour ne jamais rendre un document orphelin introuvable si la personne qui
 * l'a supprime n'est plus disponible).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->foreignId('supprime_par_id')->nullable()->after('status_doc')
                ->constrained('utilisateurs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropForeign(['supprime_par_id']);
            $table->dropColumn('supprime_par_id');
        });
    }
};
