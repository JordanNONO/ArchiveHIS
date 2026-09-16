<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mémoire persistante de l'assistant documentaire (voir AssistantChat.jsx /
 * AssistantIAService) — jusqu'ici la conversation ne vivait que dans l'état
 * React, perdue au moindre rechargement de page. Un historique par personne
 * (jamais partagé entre comptes), volontairement plafonné (voir
 * AssistantController::LIMITE_HISTORIQUE) pour ne pas grossir indéfiniment ni
 * alourdir le contexte renvoyé à Claude à chaque nouveau message.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assistant_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->onDelete('cascade');
            $table->string('role');
            $table->text('contenu');
            // Documents renvoyés par l'outil de recherche pour CE message
            // (role=assistant uniquement) — rejoués tels quels à la réouverture
            // de la bulle, plutôt que de re-questionner l'IA pour les retrouver.
            $table->json('documents')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assistant_messages');
    }
};
