<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lignes SIM : le numéro, son forfait et ce qu'il coûte. Indépendante des
 * appareils (voir telephonie_appareils) — c'est la ligne qui porte
 * l'engagement et la facture, pas le téléphone.
 *
 * `cout_mensuel` et `engagement_jusquau` ne sont pas du décor : une ligne
 * active que plus personne n'utilise continue d'être facturée, et c'est
 * exactement ce qui passe inaperçu quand le suivi se fait de tête (voir
 * l'alerte "ligne libre" de la vue d'ensemble).
 *
 * PIN et PUK sont facultatifs et chiffrés en base (cast `encrypted` sur le
 * modèle) : ce sont des codes d'accès, pas des métadonnées. Colonnes `text`
 * et non `string` parce qu'une valeur chiffrée par Laravel dépasse largement
 * les quatre chiffres d'origine.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telephonie_lignes', function (Blueprint $table) {
            $table->id();
            $table->string('numero', 25)->unique();
            $table->string('operateur', 40);
            $table->string('forfait', 80)->nullable();
            $table->decimal('cout_mensuel', 8, 2)->nullable();
            $table->string('iccid', 25)->nullable();
            $table->text('code_pin')->nullable();
            $table->text('code_puk')->nullable();
            $table->date('date_souscription')->nullable();
            $table->date('engagement_jusquau')->nullable()->index();
            // active | suspendue | resiliee
            $table->string('statut', 20)->default('active')->index();
            $table->text('observations')->nullable();
            $table->boolean('fiche_a_completer')->default(false)->index();
            $table->foreignId('cree_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telephonie_lignes');
    }
};
