<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Trace l'envoi par mail des bulletins de paie — une ligne par salarié ET
 * par tentative, jamais écrasée : si quelqu'un est renvoyé après correction
 * de son adresse mail, une nouvelle ligne s'ajoute plutôt que de remplacer
 * la précédente. L'historique complet reste lisible, même mécanisme que
 * HistoriqueStatut (append-only) plutôt qu'un compteur agrégé qui perdrait
 * le détail de qui a échoué et pourquoi.
 *
 * `mail_utilise` est un instantané de l'adresse au moment de l'envoi — pas
 * une référence vivante à utilisateurs.mail, qui peut changer après coup.
 * Sans cet instantané, relire "à qui ça a été envoyé" plus tard donnerait
 * une adresse qui n'est peut-être plus celle d'alors.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('envois_bulletins_paie', function (Blueprint $table) {
            $table->id();
            $table->date('mois');
            $table->foreignId('personnel_id')->nullable()->constrained('personnels')->nullOnDelete();
            $table->foreignId('document_archive_id')->nullable()->constrained('document_archives')->nullOnDelete();
            $table->string('mail_utilise');
            // en_attente (job pas encore passé) | envoye | echec
            $table->string('statut', 20)->default('en_attente')->index();
            $table->text('erreur')->nullable();
            $table->timestamp('envoye_le')->nullable();
            $table->foreignId('cree_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();

            $table->index(['mois', 'personnel_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('envois_bulletins_paie');
    }
};
