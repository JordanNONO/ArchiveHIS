<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Verrouillage pessimiste : évite que deux personnes remplacent le même
     * fichier en même temps (voir DocumentController::verrouiller/remplacerFichier).
     * `version_majeure`/`version_mineure` : label de version du fichier courant
     * (ex: "2.3"), incrémenté à chaque remplacement selon le type choisi.
     */
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->foreignId('verrouille_par_utilisateur_id')->nullable()->after('status_doc')
                ->constrained('utilisateurs')->nullOnDelete();
            $table->timestamp('verrouille_le')->nullable()->after('verrouille_par_utilisateur_id');
            $table->unsignedInteger('version_majeure')->default(1)->after('verrouille_le');
            $table->unsignedInteger('version_mineure')->default(0)->after('version_majeure');
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropForeign(['verrouille_par_utilisateur_id']);
            $table->dropColumn(['verrouille_par_utilisateur_id', 'verrouille_le', 'version_majeure', 'version_mineure']);
        });
    }
};
