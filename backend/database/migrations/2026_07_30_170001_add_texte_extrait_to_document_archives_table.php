<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Texte reconnu par OCR (Tesseract.js, côté navigateur au moment du scan) sur
 * les documents scannés — sert uniquement à la recherche ("retrouver un
 * document par son contenu"), jamais affiché tel quel comme un champ éditable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->text('texte_extrait')->nullable()->after('resume');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn('texte_extrait');
        });
    }
};
