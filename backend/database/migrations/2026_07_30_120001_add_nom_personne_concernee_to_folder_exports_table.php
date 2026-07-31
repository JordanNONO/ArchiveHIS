<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Permet de restreindre un export ZIP aux documents d'une seule personne
 * concernée à l'intérieur d'un sous-dossier (ex: télécharger uniquement les
 * réclamations d'un intervenant donné, pas tout le sous-dossier) — voir
 * OpenFolder.jsx, dossiers "Bénéficiaire"/"Intervenant".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('folder_exports', function (Blueprint $table) {
            $table->string('nom_personne_concernee')->nullable()->after('type_document_id');
        });
    }

    public function down(): void
    {
        Schema::table('folder_exports', function (Blueprint $table) {
            $table->dropColumn('nom_personne_concernee');
        });
    }
};
