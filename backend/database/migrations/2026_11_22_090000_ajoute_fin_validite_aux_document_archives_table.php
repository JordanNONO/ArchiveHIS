<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Date de fin de validité d'un document (titre de séjour, visite médicale,
 * formation obligatoire, permis...) — saisie par la RH au classement (voir
 * DocumentController::definirValidite()), demande explicite 2026-11-22.
 *
 * `rappel_validite_palier` retient le dernier rappel envoyé (60, 30, 7 ou 0
 * jour(s) avant), pour que la commande quotidienne documents:rappeler-validite
 * n'envoie chaque palier qu'une seule fois. Remis à zéro dès que la date
 * change.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->date('date_fin_validite')->nullable()->after('mois_concerne')->index();
            $table->smallInteger('rappel_validite_palier')->nullable()->after('date_fin_validite');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn(['date_fin_validite', 'rappel_validite_palier']);
        });
    }
};
