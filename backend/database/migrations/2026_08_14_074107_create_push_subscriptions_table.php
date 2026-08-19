<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Une ligne par navigateur/appareil abonné aux notifications système
        // (Web Push) — un même utilisateur peut être abonné depuis plusieurs
        // appareils à la fois, d'où une table à part plutôt qu'une colonne sur
        // utilisateurs. "endpoint" identifie l'abonnement de façon unique côté
        // navigateur (change si l'utilisateur réinstalle/reset son navigateur).
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->cascadeOnDelete();
            $table->text('endpoint');
            $table->string('endpoint_hash', 64)->unique();
            $table->string('public_key');
            $table->string('auth_token');
            $table->string('content_encoding')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('push_subscriptions');
    }
};
