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
        Schema::create('pai_dossiers', function (Blueprint $table) {
            $table->id();
            $table->string('titre');
            // Bénéficiaire suivi — soit un compte réel (rare, la plupart des
            // bénéficiaires suivis en PAI n'ont pas de compte dans l'appli),
            // soit un nom libre — même convention que
            // DocumentArchive::personnel_concerne_id/nom_personne_concernee.
            $table->foreignId('personnel_concerne_id')->nullable()->constrained('personnels')->onDelete('set null');
            $table->string('nom_beneficiaire')->nullable();
            $table->foreignId('responsable_secteur_id')->constrained('utilisateurs')->onDelete('cascade');
            $table->foreignId('categorie_id')->constrained('categorie_documents')->onDelete('cascade');
            $table->text('description')->nullable();
            $table->date('date_ouverture');
            // Un PAI ne se ferme jamais automatiquement (voir la demande d'origine :
            // "c'est un projet qui est suivi dans le temps... des dossiers qui ne
            // doivent jamais être fermés") — cette date reste donc null tant que
            // personne ne clôt le suivi manuellement (ex: départ du bénéficiaire).
            $table->date('date_cloture')->nullable();
            $table->foreignId('cree_par_id')->constrained('utilisateurs')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pai_dossiers');
    }
};
