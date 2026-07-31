<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Le statut BROUILLON est retiré du workflow (StatutDocument) : un document
     * déposé est désormais directement SOUMIS, sans étape brouillon intermédiaire.
     * Les documents déjà en BROUILLON doivent basculer vers SOUMIS pour rester
     * transitionnables (STATUT_TRANSITIONS n'a plus d'entrée BROUILLON).
     */
    public function up(): void
    {
        $documents = DB::table('document_archives')->where('status_doc', 'BROUILLON')->get(['id']);

        foreach ($documents as $document) {
            DB::table('document_archives')->where('id', $document->id)->update(['status_doc' => 'SOUMIS']);

            DB::table('historique_statuts')->insert([
                'document_archive_id' => $document->id,
                'utilisateur_id' => null,
                'ancien_statut' => 'BROUILLON',
                'nouveau_statut' => 'SOUMIS',
                'date_changement' => now(),
                'motif_changement' => 'Migration automatique : suppression du statut brouillon du workflow',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Irréversible : on ne peut pas distinguer les documents migrés de ceux
        // soumis normalement après coup.
    }
};
