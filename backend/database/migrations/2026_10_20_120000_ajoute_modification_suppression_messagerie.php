<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // vide_le : "vider la discussion" ne supprime rien pour l'autre
        // participant, ça masque juste l'historique antérieur à cette date
        // côté utilisateur courant (même pivot que dernier_lu_a, même
        // logique que la Corbeille plus tôt dans ce projet : chacun ne voit
        // que ce qui le concerne).
        Schema::table('conversation_utilisateur', function (Blueprint $table) {
            $table->timestamp('vide_le')->nullable();
        });

        Schema::table('messages', function (Blueprint $table) {
            $table->timestamp('modifie_le')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('conversation_utilisateur', function (Blueprint $table) {
            $table->dropColumn('vide_le');
        });
        Schema::table('messages', function (Blueprint $table) {
            $table->dropColumn('modifie_le');
        });
    }
};
