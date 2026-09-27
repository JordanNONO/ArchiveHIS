<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Retire le champ "poste", ajoute puis retiré dans la même session
 * (voir 2026_09_27_000000_add_poste_to_personnels_table) — demande annulée
 * avant d'avoir de vraies données dessus.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personnels', function (Blueprint $table) {
            $table->dropColumn('poste');
        });
    }

    public function down(): void
    {
        Schema::table('personnels', function (Blueprint $table) {
            $table->string('poste')->nullable()->after('prenom');
        });
    }
};
