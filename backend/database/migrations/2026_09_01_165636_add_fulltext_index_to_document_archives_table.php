<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            // Nom explicite : le nom auto-généré par Laravel (concaténation de
            // toutes les colonnes) dépasse la limite MySQL de 64 caractères.
            $table->fullText(['titre_document', 'resume', 'objet', 'texte_extrait', 'code_reference'], 'document_archives_fulltext');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropFullText('document_archives_fulltext');
        });
    }
};
