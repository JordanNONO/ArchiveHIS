<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('folder_exports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs')->onDelete('cascade');
            $table->foreignId('categorie_id')->nullable()->constrained('categorie_documents')->nullOnDelete();
            $table->foreignId('type_document_id')->nullable()->constrained('type_documents')->nullOnDelete();
            $table->string('nom_dossier');
            // en_attente -> en_cours -> pret | echoue
            $table->string('statut')->default('en_attente');
            $table->string('chemin_fichier')->nullable();
            $table->text('erreur')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('folder_exports');
    }
};
