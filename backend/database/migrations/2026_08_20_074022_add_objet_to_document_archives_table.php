<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            // Objet canonique (toujours en français, ex: "Salaire", "Planning") d'une
            // réclamation — jusqu'ici seulement injecté comme texte traduit dans
            // titre_document/resume, donc impossible à filtrer/grouper de façon fiable
            // (le texte affiché change selon la langue active au moment du dépôt).
            // Nullable : ne concerne que les réclamations, tout le reste laisse ce champ vide.
            $table->string('objet')->nullable()->after('resume');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn('objet');
        });
    }
};
