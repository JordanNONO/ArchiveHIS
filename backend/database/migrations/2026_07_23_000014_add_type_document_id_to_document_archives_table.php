<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->foreignId('type_document_id')->nullable()->after('categorie_id')->constrained('type_documents')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropForeign(['type_document_id']);
            $table->dropColumn('type_document_id');
        });
    }
};
