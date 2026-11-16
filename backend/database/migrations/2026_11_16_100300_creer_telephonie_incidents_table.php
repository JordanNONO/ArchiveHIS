<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pertes, casses, vols et dépassements de forfait. Remplace la section
 * "telephone" de la Fluctuation RH (voir la migration suivante, qui en reprend
 * les lignes) : ces incidents portent sur du matériel, ils appartiennent au
 * parc, pas au mouvement du personnel du mois.
 *
 * `fluctuation_rh_id` garde le lien avec la retenue créée côté paie quand la
 * suite donnée est une retenue sur salaire : le module ne rapatrie pas la
 * paie chez lui, il continue d'écrire dans la section Retenue existante, pour
 * qu'il reste un seul endroit où lire ce qui est retenu sur un salaire.
 *
 * `salarie_nom` en plus de `personnel_id` : la Fluctuation RH stocke un nom
 * en texte libre, et la reprise ne pourra pas toujours le rattacher à une
 * fiche du personnel (homonymes, salariés partis, orthographes). Mieux vaut
 * conserver le nom écrit que perdre la ligne.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telephonie_incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('personnel_id')->nullable()->constrained('personnels')->nullOnDelete();
            $table->string('salarie_nom')->nullable();
            $table->foreignId('appareil_id')->nullable()->constrained('telephonie_appareils')->nullOnDelete();
            $table->foreignId('ligne_id')->nullable()->constrained('telephonie_lignes')->nullOnDelete();

            $table->date('date_incident')->index();
            // perte | casse | vol | depassement_forfait | autre
            $table->string('nature', 30)->index();
            $table->decimal('montant', 10, 2)->nullable();
            // a_decider | prise_en_charge | retenue_salaire | assurance | sans_suite
            $table->string('suite_donnee', 30)->default('a_decider')->index();

            $table->foreignId('fluctuation_rh_id')->nullable()->constrained('fluctuations_rh')->nullOnDelete();
            $table->foreignId('justificatif_document_id')->nullable()->constrained('document_archives')->nullOnDelete();
            $table->text('observations')->nullable();

            $table->foreignId('cree_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telephonie_incidents');
    }
};
