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
        // Contenu unique (singleton) : le support de formation interne (vidéo +
        // PDF) affiché depuis le bouton "Aide" — pas besoin de plusieurs lignes
        // tant qu'il n'existe qu'une seule formation à diffuser.
        Schema::create('formations', function (Blueprint $table) {
            $table->id();
            $table->string('titre')->default('Formation - Prise en main HIS Archivage');
            $table->text('description')->nullable();
            $table->string('video_chemin')->nullable();
            $table->string('video_nom_original')->nullable();
            $table->string('video_mime')->nullable();
            $table->string('pdf_chemin')->nullable();
            $table->string('pdf_nom_original')->nullable();
            $table->foreignId('mis_a_jour_par')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('formations');
    }
};
