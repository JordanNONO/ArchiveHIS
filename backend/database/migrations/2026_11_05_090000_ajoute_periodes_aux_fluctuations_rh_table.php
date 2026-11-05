<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Congés en plusieurs périodes : un salarié pose souvent son mois en
 * plusieurs morceaux (3 au 6, puis 16 au 17), ce qu'un seul couple Du/Au ne
 * savait pas représenter — il fallait saisir autant de lignes que de
 * périodes, et le total du mois se recomptait à la main.
 *
 * `periodes` = [{"du":"2026-11-03","au":"2026-11-06"}, ...]. Les colonnes
 * date_debut et date_fin RESTENT renseignées, à la première et à la dernière
 * date de l'ensemble : les statistiques, les exports, les imports, les
 * contrôles automatiques et les relances de période d'essai continuent de les
 * lire sans rien changer, et y voient toujours l'étendue correcte du congé.
 * Une ligne sans `periodes` (toutes celles d'avant) reste une période unique
 * décrite par ces deux colonnes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fluctuations_rh', function (Blueprint $table) {
            $table->json('periodes')->nullable()->after('date_fin');
        });
    }

    public function down(): void
    {
        Schema::table('fluctuations_rh', function (Blueprint $table) {
            $table->dropColumn('periodes');
        });
    }
};
