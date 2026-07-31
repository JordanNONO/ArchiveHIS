<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Modèle (template) des étapes d'une procédure à délai légal/interne pour un
     * type de dossier donné (ex: "Sortie & Rupture" -> Courrier initial 48h ->
     * Convocation 15j -> Clôture). Chaque étape peut avoir un service responsable
     * différent : une même procédure peut passer de la RH à la Comptabilité
     * (ex: solde de tout compte) sans que ce soit une anomalie d'accès.
     */
    public function up(): void
    {
        Schema::create('etapes_workflow', function (Blueprint $table) {
            $table->id();
            $table->foreignId('categorie_document_id')->constrained('categorie_documents')->cascadeOnDelete();
            $table->unsignedSmallInteger('ordre');
            $table->string('nom');
            $table->unsignedInteger('delai_heures');
            $table->unsignedInteger('seuil_alerte_heures')->nullable();
            $table->foreignId('service_responsable_id')->nullable()->constrained('services_metier')->nullOnDelete();
            $table->timestamps();

            $table->unique(['categorie_document_id', 'ordre']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('etapes_workflow');
    }
};
