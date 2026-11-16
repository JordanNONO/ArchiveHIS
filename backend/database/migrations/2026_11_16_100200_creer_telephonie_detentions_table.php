<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Une détention est une PÉRIODE, portant sur UN SEUL objet : ce téléphone, ou
 * ce numéro, détenu par cette personne, de telle date à telle date.
 *
 * Un objet par ligne, et c'est tout l'intérêt : quand le téléphone d'un
 * salarié casse et qu'on lui en donne un autre, seule la détention de
 * l'appareil se ferme. Celle du numéro continue, ininterrompue. Avec un
 * couple téléphone+ligne dans la même ligne, le numéro serait apparu restitué
 * puis réattribué le même jour, et le "depuis quand a-t-il ce numéro"
 * devenait faux à chaque panne — alors que c'est justement ce qu'on veut
 * savoir d'une ligne qui porte un engagement et une facture.
 *
 * `remise_id` relie la détention à l'événement qui l'a ouverte (voir
 * telephonie_remises), donc à la décharge signée. Il reste nullable : la
 * reprise de l'existant crée des détentions sans remise, puisque ces
 * téléphones ont été distribués avant que le module existe.
 *
 * Exactement UN des deux parmi appareil_id et ligne_id est renseigné. La
 * règle est tenue par le modèle (TelephonieDetention) plutôt que par une
 * contrainte CHECK, pour rester lisible et portable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telephonie_detentions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('personnel_id')->nullable()->constrained('personnels')->nullOnDelete();
            $table->string('salarie_nom')->nullable();

            $table->foreignId('appareil_id')->nullable()->constrained('telephonie_appareils')->nullOnDelete();
            $table->foreignId('ligne_id')->nullable()->constrained('telephonie_lignes')->nullOnDelete();
            $table->foreignId('remise_id')->nullable()->constrained('telephonie_remises')->nullOnDelete();

            $table->date('date_debut')->index();
            $table->string('etat_debut', 20)->nullable();

            $table->date('date_fin')->nullable();
            $table->string('etat_fin', 20)->nullable();
            // restitution | transfert | incident | fin_contrat
            // Distinguer un transfert d'une restitution change ce qu'on lit
            // d'un parc : un téléphone transféré n'est jamais repassé par le
            // stock, et une ligne reprise pour quelqu'un d'autre n'a pas été
            // "rendue".
            $table->string('motif_fin', 20)->nullable();
            $table->text('observations')->nullable();

            $table->foreignId('cree_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            // Les trois questions posées à chaque écran : que détient cette
            // personne aujourd'hui, où est cet appareil, qui a ce numéro.
            $table->index(['personnel_id', 'date_fin']);
            $table->index(['appareil_id', 'date_fin']);
            $table->index(['ligne_id', 'date_fin']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telephonie_detentions');
    }
};
