<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Registre des appels téléphoniques — table dédiée plutôt qu'un bolt-on sur
 * document_archives (voir plan) : un appel n'a ni fichier, ni dossier, ni
 * besoin du workflow StatutDocument complet, juste une action (Rappeler/
 * Rappeler URGENT/Rappellera/Pour info) et un état traité/pas traité.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('appels_telephoniques', function (Blueprint $table) {
            $table->id();

            // Remplis côté client à l'ouverture du formulaire (date/heure du
            // jour, agent connecté) mais modifiables — pas de valeur par
            // défaut MySQL, l'utilisateur peut corriger avant d'enregistrer.
            $table->date('date_appel');
            $table->time('heure_appel');
            $table->foreignId('utilisateur_id')->constrained('utilisateurs');

            $table->string('appelant_nom');
            $table->string('appelant_telephone');
            $table->string('appelant_organisation')->nullable();
            // Un seul champ libre (Qualité / e-mail), fidèle au registre papier
            // d'origine plutôt que deux colonnes distinctes.
            $table->string('appelant_qualite_email')->nullable();

            $table->string('objet')->nullable();
            $table->text('message')->nullable();

            // "SI APPEL ORIENTÉ" sur le papier — quasi jamais rempli dans
            // l'export réel mais conservé pour fidélité au registre existant.
            $table->string('oriente_nom')->nullable();
            $table->string('oriente_service')->nullable();

            // Même duo FK+texte-libre que DocumentArchive.personnel_concerne_id/
            // nom_personne_concernee : une vraie fiche personnel si elle existe,
            // sinon un texte libre ("M. le Directeur", "Communication"...).
            $table->foreignId('personnel_concerne_id')->nullable()->constrained('personnels')->nullOnDelete();
            $table->string('personne_concernee_texte')->nullable();

            $table->string('action');

            $table->timestamp('traite_le')->nullable();
            $table->foreignId('traite_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('appels_telephoniques');
    }
};
