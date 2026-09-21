<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le nom de l'appelant n'est plus obligatoire — certains appels (numéro
 * masqué, appelant qui ne se présente pas, erreur de numéro...) doivent
 * pouvoir être consignés quand même, avec au moins le téléphone et l'action.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->string('appelant_nom')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->string('appelant_nom')->nullable(false)->change();
        });
    }
};
