<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Une pièce jointe ne disait jusqu'ici que son nom, son poids et son format.
 * Pour le traitement d'un courrier, ça ne suffit pas : il faut savoir CE QUE
 * la pièce prouve (une preuve de paiement n'est pas une facture) et QUI l'a
 * versée au dossier — c'est la trace qui fait foi quand on rouvre un courrier
 * six mois plus tard (voir DocumentController::resoudreCourrier()).
 *
 * Les pièces déjà en base passent en 'autre' : elles ont été déposées à
 * l'archivage, sans que le type ait jamais été demandé. Mieux vaut l'avouer
 * que de leur inventer une qualification.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_pieces_jointes', function (Blueprint $table) {
            $table->string('type_piece')->default('autre')->after('nom_fichier_original');
            $table->foreignId('ajoute_par_utilisateur_id')->nullable()->after('type_piece')
                ->constrained('utilisateurs')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('document_pieces_jointes', function (Blueprint $table) {
            $table->dropForeign(['ajoute_par_utilisateur_id']);
            $table->dropColumn(['type_piece', 'ajoute_par_utilisateur_id']);
        });
    }
};
