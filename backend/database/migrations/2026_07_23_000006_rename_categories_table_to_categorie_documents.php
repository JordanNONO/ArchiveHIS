<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('categories', 'categorie_documents');
        DB::statement('ALTER TABLE categorie_documents RENAME COLUMN label TO libelle_cat');

        Schema::table('categorie_documents', function (Blueprint $table) {
            $table->string('code', 100)->nullable()->unique()->after('libelle_cat');
        });
    }

    public function down(): void
    {
        Schema::table('categorie_documents', function (Blueprint $table) {
            $table->dropColumn('code');
        });

        DB::statement('ALTER TABLE categorie_documents RENAME COLUMN libelle_cat TO label');
        Schema::rename('categorie_documents', 'categories');
    }
};
