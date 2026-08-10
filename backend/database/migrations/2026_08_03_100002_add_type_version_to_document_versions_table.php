<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Label de version (majeure.mineure) figé au moment où ce cliché a été
     * archivé — voir DocumentController::remplacerFichier().
     */
    public function up(): void
    {
        Schema::table('document_versions', function (Blueprint $table) {
            $table->string('type_version')->default('mineure')->after('numero_version');
            $table->unsignedInteger('numero_majeur')->default(1)->after('type_version');
            $table->unsignedInteger('numero_mineur')->default(0)->after('numero_majeur');
        });
    }

    public function down(): void
    {
        Schema::table('document_versions', function (Blueprint $table) {
            $table->dropColumn(['type_version', 'numero_majeur', 'numero_mineur']);
        });
    }
};
