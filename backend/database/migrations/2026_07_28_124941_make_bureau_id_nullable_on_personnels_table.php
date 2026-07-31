<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Un intervenant/bénéficiaire qui s'inscrit lui-même n'appartient à aucun
     * bureau interne — bureau_id doit pouvoir rester vide pour ces comptes
     * (contrairement au personnel créé par un admin, toujours rattaché à un bureau).
     * Pas de doctrine/dbal installé : on passe par du SQL brut plutôt que
     * ->nullable()->change().
     */
    public function up(): void
    {
        Schema::table('personnels', function (Blueprint $table) {
            $table->dropForeign('personnels_bureau_id_foreign');
        });

        DB::statement('ALTER TABLE personnels MODIFY bureau_id BIGINT UNSIGNED NULL');

        Schema::table('personnels', function (Blueprint $table) {
            $table->foreign('bureau_id')->references('id')->on('bureaux')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('personnels', function (Blueprint $table) {
            $table->dropForeign('personnels_bureau_id_foreign');
        });

        DB::statement('ALTER TABLE personnels MODIFY bureau_id BIGINT UNSIGNED NOT NULL');

        Schema::table('personnels', function (Blueprint $table) {
            $table->foreign('bureau_id')->references('id')->on('bureaux');
        });
    }
};
