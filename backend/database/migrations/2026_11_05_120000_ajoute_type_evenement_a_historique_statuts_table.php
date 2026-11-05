<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * L'historique d'un document ne contenait que des changements de statut. Il
 * accueille désormais aussi les RENOMMAGES, pour qu'on sache qui a changé le
 * titre d'un document et quand — voir DocumentController::renommer().
 *
 * `type_evenement` distingue les deux plutôt que d'enregistrer un renommage
 * comme un faux changement de statut : le fil d'activité global
 * (ActiviteController) lit cette même table et afficherait sinon « Validé →
 * Validé » à chaque renommage. Les lignes existantes gardent la valeur par
 * défaut 'statut', qui décrit exactement ce qu'elles sont.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('historique_statuts', function (Blueprint $table) {
            $table->string('type_evenement', 20)->default('statut')->after('utilisateur_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('historique_statuts', function (Blueprint $table) {
            $table->dropColumn('type_evenement');
        });
    }
};
