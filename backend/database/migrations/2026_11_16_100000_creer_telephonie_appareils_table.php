<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Parc des téléphones confiés aux salariés. Table séparée des lignes SIM
 * (telephonie_lignes) : une ligne survit à l'appareil qui casse, un appareil
 * rendu repart avec une autre SIM — les relier dans une seule fiche obligerait
 * à tout ressaisir à chaque panne et couperait l'historique du numéro.
 *
 * Presque tout est facultatif, volontairement : au démarrage, les téléphones
 * sont déjà entre les mains des salariés et personne n'ira relever dix-huit
 * IMEI au dos d'appareils dispersés sur le terrain. Un modèle suffit à créer
 * la fiche ; `fiche_a_completer` la signale jusqu'à ce que le reste soit
 * renseigné (voir l'écran de reprise de l'existant).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telephonie_appareils', function (Blueprint $table) {
            $table->id();
            $table->string('modele');
            // Unique MAIS nullable : MySQL accepte plusieurs NULL dans un index
            // unique, donc on garde l'IMEI facultatif tout en interdisant qu'un
            // même appareil soit enregistré deux fois une fois l'IMEI connu.
            $table->string('imei', 20)->nullable()->unique();
            $table->string('numero_serie', 60)->nullable();
            $table->date('date_achat')->nullable();
            $table->decimal('prix_achat', 10, 2)->nullable();
            // en_stock | en_service | hors_service | reforme | perdu | vole
            $table->string('etat', 20)->default('en_stock')->index();
            $table->text('observations')->nullable();
            $table->boolean('fiche_a_completer')->default(false)->index();
            $table->foreignId('cree_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
            // Un appareil réformé reste dans l'historique des attributions : on
            // le sort des listes sans effacer qui l'a eu, ni les incidents
            // qu'il a connus.
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telephonie_appareils');
    }
};
