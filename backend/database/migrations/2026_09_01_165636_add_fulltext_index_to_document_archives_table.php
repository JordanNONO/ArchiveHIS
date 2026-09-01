<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Le parseur FULLTEXT par défaut de MySQL ne coupe pas les mots sur '_'
     * (seulement sur les espaces/ponctuation courante) — or les titres/
     * références de ce projet sont massivement en snake_case/kebab-case
     * (ex: "PRO-RH-013_Reporting_RH_Mensuel_HIS"), ce qui rendait
     * MATCH AGAINST("Reporting") introuvable, tout restant fusionné en un
     * seul token. D'où une colonne dédiée, normalisée (- et _ remplacés par
     * des espaces) à l'écriture — voir DocumentArchive::normaliserTexteRecherche()
     * — plutôt qu'indexer directement les colonnes affichées telles quelles.
     */
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->text('texte_recherche')->nullable()->after('texte_extrait');
        });

        Schema::table('document_archives', function (Blueprint $table) {
            $table->fullText('texte_recherche', 'document_archives_fulltext');
        });

        // Rétro-remplit les documents déjà en base (le modèle ne s'exécute pas
        // sur des lignes déjà existantes) — mêmes règles de normalisation que
        // DocumentArchive::normaliserTexteRecherche(), en SQL pour ne pas
        // recharger chaque ligne en mémoire. REPLACE() imbriqués plutôt que
        // REGEXP_REPLACE (indisponible avant MySQL 8.0.4, or le serveur de
        // dev tourne en 5.7 — voir docker-compose.yml).
        DB::statement("
            UPDATE document_archives
            SET texte_recherche = REPLACE(REPLACE(
                CONCAT_WS(' ', titre_document, resume, objet, texte_extrait, code_reference),
                '_', ' '
            ), '-', ' ')
        ");
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropFullText('document_archives_fulltext');
        });
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn('texte_recherche');
        });
    }
};
