<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categorie_documents', function (Blueprint $table) {
            // Service métier "propriétaire" du dossier : détermine qui voit les
            // documents confidentiels qui y sont rangés, indépendamment de qui les
            // a archivés (un document rangé dans "Comptabilité" par quelqu'un des
            // RH doit être visible par la Comptabilité, pas rester caché chez les RH).
            $table->foreignId('service_metier_id')->nullable()->after('code')->constrained('services_metier')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('categorie_documents', function (Blueprint $table) {
            $table->dropConstrainedForeignId('service_metier_id');
        });
    }
};
