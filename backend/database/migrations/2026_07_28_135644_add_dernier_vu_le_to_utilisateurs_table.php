<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Horodatage de la dernière requête authentifiée, mis à jour par
     * AuthPersonnelMiddleware — sert à déterminer qui est "connecté" (activité
     * récente) pour la vue admin, sans dépendre d'une table de sessions.
     */
    public function up(): void
    {
        Schema::table('utilisateurs', function (Blueprint $table) {
            $table->timestamp('dernier_vu_le')->nullable()->after('password');
        });
    }

    public function down(): void
    {
        Schema::table('utilisateurs', function (Blueprint $table) {
            $table->dropColumn('dernier_vu_le');
        });
    }
};
