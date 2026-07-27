<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_archive_id')->constrained('document_archives')->onDelete('cascade');
            $table->unsignedInteger('numero_version');
            $table->foreignId('utilisateur_id')->constrained('utilisateurs');
            $table->string('nom_fichier_original');
            $table->string('chemin_stockage_serveur');
            $table->string('format_mime')->nullable();
            $table->unsignedBigInteger('taille')->nullable();
            $table->string('checksum_sha256')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_versions');
    }
};
