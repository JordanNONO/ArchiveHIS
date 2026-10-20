<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
        });

        // Pivot plutôt que deux colonnes utilisateur_un_id/utilisateur_deux_id
        // sur conversations : retrouver "mes conversations" reste une simple
        // jointure, et ça laisse la porte ouverte à plus de deux participants
        // sans changer le schéma plus tard. dernier_lu_a sert à calculer le
        // compteur de non-lus (messages des autres postés après cette date).
        Schema::create('conversation_utilisateur', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->timestamp('dernier_lu_a')->nullable();
            $table->timestamps();
            $table->unique(['conversation_id', 'utilisateur_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->text('contenu');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversation_utilisateur');
        Schema::dropIfExists('conversations');
    }
};
