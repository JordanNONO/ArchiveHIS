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
        Schema::create('document_pieces_jointes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_archive_id')->constrained('document_archives')->onDelete('cascade');
            $table->string('nom_fichier_original');
            $table->string('chemin_stockage_serveur');
            $table->string('format_mime')->nullable();
            $table->unsignedBigInteger('taille')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_pieces_jointes');
    }
};
