<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Compteur dédié (une ligne par préfixe+mois, ex: "CRE-2610") pour
        // générer les références de courrier de façon atomique — voir
        // DocumentController::genererReferenceCourrier(). Un simple count()+1
        // sur document_archives pouvait donner la même référence à deux
        // courriers enregistrés presque en même temps (retour utilisateur :
        // une recherche faisait ressortir "un autre colis").
        Schema::create('courrier_compteurs', function (Blueprint $table) {
            $table->id();
            $table->string('cle')->unique();
            $table->unsignedInteger('valeur')->default(0);
            $table->timestamps();
        });

        // Initialise chaque compteur à partir des références déjà archivées —
        // sans ça, le premier courrier créé après ce déploiement repartirait
        // de la séquence 01 pour le mois en cours, et entrerait en collision
        // avec des références existantes de ce même mois (exactement le bug
        // qu'on corrige ici). Ne retient que les références au format actuel
        // (CRE-260405) : l'ancien format aléatoire (CRE-MTLLYGTI0, avant le
        // 2026-10-07) ne matche jamais et n'a donc rien à initialiser.
        $references = DB::table('document_archives')
            ->whereNotNull('sens_courrier')
            ->whereNotNull('code_reference')
            ->pluck('code_reference');

        $maxParCle = [];
        foreach ($references as $reference) {
            if (!preg_match('/^(CRE|CRS)-(\d{4})(\d{2})$/', $reference, $m)) {
                continue;
            }
            $cle = "{$m[1]}-{$m[2]}";
            $sequence = (int) $m[3];
            if (!isset($maxParCle[$cle]) || $sequence > $maxParCle[$cle]) {
                $maxParCle[$cle] = $sequence;
            }
        }

        foreach ($maxParCle as $cle => $valeur) {
            DB::table('courrier_compteurs')->insert([
                'cle' => $cle,
                'valeur' => $valeur,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('courrier_compteurs');
    }
};
