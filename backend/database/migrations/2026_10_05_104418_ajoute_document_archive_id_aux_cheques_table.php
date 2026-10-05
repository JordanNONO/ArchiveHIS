<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lien vers la fiche PDF que ChequeForm.jsx archive automatiquement dans
 * ADMIN_DOC/CHEQUES à la création (voir ChequeController::attacherDocument())
 * — permet de supprimer les deux ensemble au lieu qu'ils restent
 * indépendants l'un de l'autre.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->foreignId('document_archive_id')->nullable()->after('chemin_scan')
                ->constrained('document_archives')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->dropConstrainedForeignId('document_archive_id');
        });
    }
};
