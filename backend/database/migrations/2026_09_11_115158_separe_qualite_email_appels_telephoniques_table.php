<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * "Qualité / e-mail" (un seul champ libre, fidèle au registre papier
 * d'origine) est séparé en deux vrais champs, plus exploitables — décidé
 * après coup, une fois la fonctionnalité en usage réel.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->string('appelant_qualite')->nullable()->after('appelant_organisation');
            $table->string('appelant_email')->nullable()->after('appelant_qualite');
        });

        // Reprend les éventuelles lignes déjà saisies avec l'ancien champ
        // combiné : une valeur qui ressemble à une adresse (contient "@")
        // part dans appelant_email, le reste dans appelant_qualite.
        DB::table('appels_telephoniques')->whereNotNull('appelant_qualite_email')->orderBy('id')->chunk(100, function ($lignes) {
            foreach ($lignes as $ligne) {
                $valeur = trim((string) $ligne->appelant_qualite_email);
                if ($valeur === '') {
                    continue;
                }
                DB::table('appels_telephoniques')->where('id', $ligne->id)->update(
                    str_contains($valeur, '@')
                        ? ['appelant_email' => $valeur]
                        : ['appelant_qualite' => $valeur]
                );
            }
        });

        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->dropColumn('appelant_qualite_email');
        });
    }

    public function down(): void
    {
        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->string('appelant_qualite_email')->nullable()->after('appelant_organisation');
        });

        DB::table('appels_telephoniques')->orderBy('id')->chunk(100, function ($lignes) {
            foreach ($lignes as $ligne) {
                $recombine = trim(collect([$ligne->appelant_qualite, $ligne->appelant_email])->filter()->implode(' / '));
                if ($recombine !== '') {
                    DB::table('appels_telephoniques')->where('id', $ligne->id)->update(['appelant_qualite_email' => $recombine]);
                }
            }
        });

        Schema::table('appels_telephoniques', function (Blueprint $table) {
            $table->dropColumn(['appelant_qualite', 'appelant_email']);
        });
    }
};
