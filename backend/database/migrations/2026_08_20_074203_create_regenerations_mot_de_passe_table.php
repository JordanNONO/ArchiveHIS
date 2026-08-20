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
        // Trace d'audit : "qui a régénéré le mot de passe de qui, et quand" —
        // jusqu'ici seul utilisateurs.updated_at changeait, un champ qui bouge
        // pour n'importe quelle modification de compte, donc inexploitable pour
        // savoir précisément si/quand un mot de passe a été régénéré.
        Schema::create('regenerations_mot_de_passe', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->onDelete('cascade');
            $table->foreignId('regenere_par_id')->nullable()->constrained('utilisateurs')->onDelete('set null');
            $table->timestamp('created_at')->useCurrent();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('regenerations_mot_de_passe');
    }
};
