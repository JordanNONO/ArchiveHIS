<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Qui intervient chez qui — sert par exemple à proposer au bénéficiaire
     * les bons auxiliaires à noter (voir "Qualité de la prestation").
     * Table pensée pour être alimentée par une synchronisation avec le
     * logiciel de télégestion externe (planning réel), pas saisie à la main :
     * volontairement minimale (pas de dates de début/fin, pas de fréquence),
     * on l'enrichira une fois cette intégration définie.
     */
    public function up(): void
    {
        Schema::create('affectations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('intervenant_personnel_id')->constrained('personnels')->cascadeOnDelete();
            $table->foreignId('beneficiaire_personnel_id')->constrained('personnels')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['intervenant_personnel_id', 'beneficiaire_personnel_id'], 'affectations_intervenant_beneficiaire_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('affectations');
    }
};
