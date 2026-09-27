<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Migration de données (pas de schéma) : le mutateur ajouté sur
 * CategorieDocument (libelle_cat/libelle_cat_en) ne s'applique qu'aux
 * écritures futures — les dossiers majeurs déjà créés restent tels quels
 * sans ce passage ponctuel en majuscules.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (DB::table('categorie_documents')->select('id', 'libelle_cat', 'libelle_cat_en')->get() as $categorie) {
            DB::table('categorie_documents')->where('id', $categorie->id)->update([
                'libelle_cat' => $categorie->libelle_cat !== null ? mb_strtoupper($categorie->libelle_cat, 'UTF-8') : null,
                'libelle_cat_en' => $categorie->libelle_cat_en !== null ? mb_strtoupper($categorie->libelle_cat_en, 'UTF-8') : null,
            ]);
        }
    }

    public function down(): void
    {
        // Irréversible (la casse d'origine n'est pas conservée) — les libellés
        // restent en majuscules même en cas de rollback, comme le veut
        // désormais le mutateur du modèle.
    }
};
