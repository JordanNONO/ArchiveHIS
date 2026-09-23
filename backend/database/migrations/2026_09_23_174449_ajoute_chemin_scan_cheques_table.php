<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            // Photo/scan facultatif du chèque physique, joint à l'enregistrement —
            // sert à vérifier après coup qu'une saisie (montant, numéro...) n'a
            // pas été mal recopiée par rapport à l'original.
            $table->string('chemin_scan', 500)->nullable()->after('facture_reglee');
        });
    }

    public function down(): void
    {
        Schema::table('cheques', function (Blueprint $table) {
            $table->dropColumn('chemin_scan');
        });
    }
};
