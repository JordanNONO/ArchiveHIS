<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            // Même rôle que etat_courrier pour le courrier : mémorise le
            // libellé précis ("Lu et approuvé" / "Lu et rejeté") plutôt que
            // de se contenter du statut générique (Validé et traité /
            // Incomplet-Rejeté), pour un historique lisible.
            $table->string('decision_qualite')->nullable()->after('etat_courrier');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn('decision_qualite');
        });
    }
};
