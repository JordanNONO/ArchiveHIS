<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * document_versions.utilisateur_id référence qui a déposé cette version —
     * un simple historique, pas une dépendance bloquante. Contrairement à ses
     * tables sœurs (historique_statuts, suivis_delais), elle avait été créée
     * sans nullOnDelete(), ce qui empêchait de supprimer un personnel dès
     * qu'il avait remplacé/corrigé au moins un fichier (contrainte FK violée).
     * Pas de doctrine/dbal installé : SQL brut, comme pour bureau_id.
     */
    public function up(): void
    {
        Schema::table('document_versions', function (Blueprint $table) {
            $table->dropForeign('document_versions_utilisateur_id_foreign');
        });

        DB::statement('ALTER TABLE document_versions MODIFY utilisateur_id BIGINT UNSIGNED NULL');

        Schema::table('document_versions', function (Blueprint $table) {
            $table->foreign('utilisateur_id')->references('id')->on('utilisateurs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_versions', function (Blueprint $table) {
            $table->dropForeign('document_versions_utilisateur_id_foreign');
        });

        DB::statement('ALTER TABLE document_versions MODIFY utilisateur_id BIGINT UNSIGNED NOT NULL');

        Schema::table('document_versions', function (Blueprint $table) {
            $table->foreign('utilisateur_id')->references('id')->on('utilisateurs');
        });
    }
};
