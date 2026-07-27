<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('documents', 'document_archives');

        DB::statement('ALTER TABLE document_archives CHANGE reference code_reference VARCHAR(255) NOT NULL');
        DB::statement('ALTER TABLE document_archives CHANGE titre titre_document VARCHAR(255) NOT NULL');
        DB::statement('ALTER TABLE document_archives CHANGE file_path chemin_stockage_serveur VARCHAR(255) NULL');
        DB::statement('ALTER TABLE document_archives CHANGE type format_mime VARCHAR(255) NOT NULL');
        DB::statement('ALTER TABLE document_archives CHANGE category_id categorie_id BIGINT UNSIGNED NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE document_archives CHANGE categorie_id category_id BIGINT UNSIGNED NOT NULL');
        DB::statement('ALTER TABLE document_archives CHANGE format_mime type VARCHAR(255) NOT NULL');
        DB::statement('ALTER TABLE document_archives CHANGE chemin_stockage_serveur file_path VARCHAR(255) NULL');
        DB::statement('ALTER TABLE document_archives CHANGE titre_document titre VARCHAR(255) NOT NULL');
        DB::statement('ALTER TABLE document_archives CHANGE code_reference reference VARCHAR(255) NOT NULL');

        Schema::rename('document_archives', 'documents');
    }
};
