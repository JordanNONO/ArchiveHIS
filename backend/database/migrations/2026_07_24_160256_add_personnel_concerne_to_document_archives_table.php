<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * "Concerné" = la personne dont parle le document (ex: le salarié d'un CV,
     * d'un contrat...), distinct de utilisateur_id qui est celui qui l'a téléversé
     * (souvent un RH). Le nom libre couvre les cas sans compte (ex: un candidat
     * pas encore embauché lors du recrutement).
     */
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->foreignId('personnel_concerne_id')->nullable()->after('utilisateur_id')
                ->constrained('personnels')->nullOnDelete();
            $table->string('nom_personne_concernee')->nullable()->after('personnel_concerne_id');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropForeign(['personnel_concerne_id']);
            $table->dropColumn(['personnel_concerne_id', 'nom_personne_concernee']);
        });
    }
};
