<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sous-dossiers imbriqués façon explorateur de fichiers (ex: "Promesse
 * d'embauche" créé à l'intérieur de "CV" doit rester dans "CV", pas remonter
 * à la racine de la catégorie) — un TypeDocument peut désormais avoir un
 * autre TypeDocument comme parent. `parent_id` NULL = dossier à la racine de
 * la catégorie, comme avant cette migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('type_documents', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('categorie_id')
                ->constrained('type_documents')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('type_documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_id');
        });
    }
};
