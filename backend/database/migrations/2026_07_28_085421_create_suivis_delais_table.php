<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Suivi en cours d'une procédure sur un dossier : à quelle étape on en est,
     * depuis quand, et le niveau d'alerte courant (calculé périodiquement par la
     * commande delais:verifier). Le "dossier" est identifié par le document qui a
     * déclenché la procédure (ex: lettre de démission) ; les documents produits aux
     * étapes suivantes (convocation, certificat...) sont liés au même salarié via
     * personnel_concerne_id, sans qu'il soit nécessaire de créer une entité "dossier"
     * séparée.
     */
    public function up(): void
    {
        Schema::create('suivis_delais', function (Blueprint $table) {
            $table->id();
            $table->foreignId('document_declencheur_id')->constrained('document_archives')->cascadeOnDelete();
            $table->foreignId('personnel_concerne_id')->nullable()->constrained('personnels')->nullOnDelete();
            $table->foreignId('etape_workflow_id')->constrained('etapes_workflow')->cascadeOnDelete();
            $table->dateTime('etape_demarree_le');
            $table->dateTime('echeance_le');
            $table->string('niveau_alerte')->default('VERT');
            $table->timestamp('manager_notifie_le')->nullable();
            $table->timestamp('termine_le')->nullable();
            $table->foreignId('utilisateur_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();

            $table->index(['niveau_alerte', 'termine_le']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suivis_delais');
    }
};
