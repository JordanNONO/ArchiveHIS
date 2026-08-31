<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * RoleController::store() valide 'acreditation' comme nullable (et le formulaire
 * "Nouveau rôle" ne propose même pas ce champ), mais la colonne était restée
 * NOT NULL depuis la création de la table — toute création de rôle sans accréditation
 * échouait avec une erreur SQL 1048.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('acreditation')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->string('acreditation')->nullable(false)->change();
        });
    }
};
