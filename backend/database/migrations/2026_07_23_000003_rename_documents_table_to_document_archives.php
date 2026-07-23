<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('documents', 'document_archives');

        DB::statement('ALTER TABLE document_archives RENAME COLUMN reference TO code_reference');
        DB::statement('ALTER TABLE document_archives RENAME COLUMN titre TO titre_document');
        DB::statement('ALTER TABLE document_archives RENAME COLUMN file_path TO chemin_stockage_serveur');
        DB::statement('ALTER TABLE document_archives RENAME COLUMN type TO format_mime');
        DB::statement('ALTER TABLE document_archives RENAME COLUMN category_id TO categorie_id');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE document_archives RENAME COLUMN categorie_id TO category_id');
        DB::statement('ALTER TABLE document_archives RENAME COLUMN format_mime TO type');
        DB::statement('ALTER TABLE document_archives RENAME COLUMN chemin_stockage_serveur TO file_path');
        DB::statement('ALTER TABLE document_archives RENAME COLUMN titre_document TO titre');
        DB::statement('ALTER TABLE document_archives RENAME COLUMN code_reference TO reference');

        Schema::rename('document_archives', 'documents');
    }
};
