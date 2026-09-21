<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registre des chèques reçus par l'association — table dédiée, même
 * principe que appels_telephoniques (pas un document, pas de fichier à
 * archiver, juste une ligne de registre). Colonnes calquées sur le tableur
 * "État des chèques" utilisé jusqu'ici (Excel, un onglet par mois, groupé
 * par banque de dépôt) : N° bordereau de remise, dates de dépôt/émission,
 * banque de dépôt/émettrice, émetteur/bénéficiaire, montant, facture réglée.
 *
 * traite_le/traite_par_id/note_traitement : même triade que
 * appels_telephoniques — ici, "traité" = chèque vérifié/rapproché par la
 * comptabilité (indépendant de date_depot, qui n'est qu'une donnée saisie).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cheques', function (Blueprint $table) {
            $table->id();
            $table->foreignId('utilisateur_id')->constrained('utilisateurs');
            $table->string('numero_bordereau_remise')->nullable();
            $table->date('date_depot')->nullable();
            $table->string('banque_depot')->nullable();
            $table->date('date_emission');
            $table->string('numero_cheque');
            $table->string('banque_emettrice')->nullable();
            $table->string('nom_emetteur');
            $table->string('nom_beneficiaire')->nullable();
            $table->decimal('montant', 12, 2);
            $table->string('facture_reglee')->nullable();
            $table->timestamp('traite_le')->nullable();
            $table->foreignId('traite_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->text('note_traitement')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cheques');
    }
};
