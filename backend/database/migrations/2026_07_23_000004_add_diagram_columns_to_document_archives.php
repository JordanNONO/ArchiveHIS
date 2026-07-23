<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->string('nom_fichier_original')->nullable()->after('titre_document');
            $table->timestamp('date_archivage')->nullable();
            $table->unsignedSmallInteger('duree_conservation_annees')->default(5);
            $table->string('niveau_confidentialite', 30)->default('INTERNE');
            $table->string('checksum_sha256', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn([
                'nom_fichier_original',
                'date_archivage',
                'duree_conservation_annees',
                'niveau_confidentialite',
                'checksum_sha256',
            ]);
        });
    }
};
