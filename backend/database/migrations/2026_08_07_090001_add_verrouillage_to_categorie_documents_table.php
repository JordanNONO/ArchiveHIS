<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Verrouillage "gel administratif" d'un dossier (ex: le temps d'un audit) —
     * différent du verrouillage document par document (voir
     * document_archives.verrouille_par_utilisateur_id, un verrou d'édition
     * concurrente) : ici, bloque tout nouveau dépôt/sous-dossier et le
     * renommage/suppression du dossier ou de ses sous-dossiers, jusqu'au
     * déverrouillage (voir CategorieController::verrouiller/deverrouiller).
     */
    public function up(): void
    {
        Schema::table('categorie_documents', function (Blueprint $table) {
            $table->foreignId('verrouille_par_utilisateur_id')->nullable()
                ->constrained('utilisateurs')->nullOnDelete();
            $table->timestamp('verrouille_le')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('categorie_documents', function (Blueprint $table) {
            $table->dropForeign(['verrouille_par_utilisateur_id']);
            $table->dropColumn(['verrouille_par_utilisateur_id', 'verrouille_le']);
        });
    }
};
