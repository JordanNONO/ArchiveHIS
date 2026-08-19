<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Libellé anglais optionnel pour les catégories et sous-dossiers — ce sont de
 * vraies données saisies par l'admin (pas du texte fixe de l'appli), donc pas
 * traduisibles via les fichiers i18n statiques. Nullable et à part de la
 * colonne française existante : tant qu'aucune traduction n'est saisie,
 * l'affichage retombe sur le libellé français (voir libelleLocalise() côté
 * frontend) — rien à migrer/remplir de force pour les dossiers déjà créés.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('categorie_documents', function (Blueprint $table) {
            $table->string('libelle_cat_en')->nullable()->after('libelle_cat');
        });
        Schema::table('type_documents', function (Blueprint $table) {
            $table->string('libelle_en')->nullable()->after('libelle');
        });
    }

    public function down(): void
    {
        Schema::table('categorie_documents', function (Blueprint $table) {
            $table->dropColumn('libelle_cat_en');
        });
        Schema::table('type_documents', function (Blueprint $table) {
            $table->dropColumn('libelle_en');
        });
    }
};
