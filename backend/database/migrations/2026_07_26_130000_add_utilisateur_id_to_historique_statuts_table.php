<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('historique_statuts', function (Blueprint $table) {
            $table->foreignId('utilisateur_id')->nullable()->after('document_archive_id')->constrained('utilisateurs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('historique_statuts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('utilisateur_id');
        });
    }
};
