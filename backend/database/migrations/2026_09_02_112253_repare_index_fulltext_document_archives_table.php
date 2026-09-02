<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Répare 2026_09_01_165636_add_fulltext_index_to_document_archives_table
 * pour les environnements où cette migration a déjà été exécutée AVANT sa
 * correction (l'ancienne version indexait directement titre_document/resume/
 * objet/texte_extrait/code_reference, sans colonne texte_recherche) — Laravel
 * ne rejoue jamais une migration déjà marquée "Ran" même si son contenu a
 * changé depuis, d'où cette migration séparée plutôt qu'une modification de
 * l'ancienne, qui n'aurait aucun effet sur un serveur déjà migré.
 *
 * Écrite pour être sans danger dans les deux cas de figure (ancienne version
 * déjà jouée, ou nouvelle version déjà jouée en dev local) : chaque étape
 * vérifie l'état actuel avant d'agir.
 */
return new class extends Migration
{
    public function up(): void
    {
        $indexExistant = DB::select("SHOW INDEX FROM document_archives WHERE Key_name = 'document_archives_fulltext'");
        if (!empty($indexExistant)) {
            Schema::table('document_archives', function (Blueprint $table) {
                $table->dropFullText('document_archives_fulltext');
            });
        }

        if (!Schema::hasColumn('document_archives', 'texte_recherche')) {
            Schema::table('document_archives', function (Blueprint $table) {
                $table->text('texte_recherche')->nullable()->after('texte_extrait');
            });
        }

        Schema::table('document_archives', function (Blueprint $table) {
            $table->fullText('texte_recherche', 'document_archives_fulltext');
        });

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
