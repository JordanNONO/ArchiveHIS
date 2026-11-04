<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Numéro d'annonce (AP-2026-11-0042) : le cabinet de paie et HIS doivent
 * pouvoir citer la même référence dans un mail ou au téléphone. Numérotation
 * repartant de 1 chaque mois, comme les registres courriers/chèques.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('annonces_paie', function (Blueprint $table) {
            $table->string('reference', 30)->nullable()->after('id');
        });

        // Les annonces déjà saisies reçoivent leur numéro dans l'ordre de
        // création, mois par mois, pour qu'aucune ne reste sans référence.
        $parMois = DB::table('annonces_paie')->orderBy('mois')->orderBy('id')->get()->groupBy('mois');
        foreach ($parMois as $mois => $annonces) {
            $rang = 0;
            foreach ($annonces as $annonce) {
                $rang++;
                DB::table('annonces_paie')->where('id', $annonce->id)->update([
                    'reference' => sprintf('AP-%s-%04d', substr((string) $mois, 0, 7), $rang),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('annonces_paie', function (Blueprint $table) {
            $table->dropColumn('reference');
        });
    }
};
