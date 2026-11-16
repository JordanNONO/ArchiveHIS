<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Qui détient quoi, depuis quand, et jusqu'à quand : la table qui relie un
 * salarié à un appareil et/ou à une ligne. Les deux sont facultatifs, car les
 * deux cas existent — un téléphone prêté sans SIM dédiée, une SIM glissée dans
 * l'appareil personnel d'un salarié.
 *
 * Une attribution n'est jamais modifiée pour "changer de détenteur" : on la
 * clôt (date_restitution) et on en crée une autre. C'est ce qui fait qu'un
 * numéro garde son historique complet en changeant trois fois de téléphone.
 *
 * La décharge : le PDF signé est archivé comme n'importe quel document
 * (decharge_document_id vers document_archives), et les colonnes qui
 * l'entourent sont la preuve — quand elle a été envoyée, quand elle a été
 * signée, depuis quelle adresse IP, et le tracé lui-même. Sans ces traces, un
 * PDF portant une image de signature ne prouve rien.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telephonie_attributions', function (Blueprint $table) {
            $table->id();
            // Nullable et nullOnDelete, pas cascadeOnDelete : Personnels n'a
            // pas de SoftDeletes, une suppression y est définitive, et une
            // cascade effacerait la trace de qui a détenu quel téléphone —
            // exactement ce que ce module existe pour conserver. Le nom écrit
            // reste dans salarie_nom, comme pour les incidents.
            $table->foreignId('personnel_id')->nullable()->constrained('personnels')->nullOnDelete();
            $table->string('salarie_nom')->nullable();
            $table->foreignId('appareil_id')->nullable()->constrained('telephonie_appareils')->nullOnDelete();
            $table->foreignId('ligne_id')->nullable()->constrained('telephonie_lignes')->nullOnDelete();

            $table->date('date_remise')->index();
            // neuf | bon | usage
            $table->string('etat_remise', 20)->nullable();
            $table->boolean('avec_chargeur')->default(false);
            $table->boolean('avec_coque')->default(false);
            $table->text('observations')->nullable();

            $table->date('date_restitution')->nullable()->index();
            $table->string('etat_restitution', 20)->nullable();
            $table->text('observations_restitution')->nullable();

            // non_requise | a_signer | signee | refusee
            // "non_requise" couvre la reprise de l'existant : ces téléphones
            // sont déjà distribués, réclamer une décharge rétroactive à dix-huit
            // personnes ferait abandonner la reprise avant la troisième ligne.
            $table->string('decharge_statut', 20)->default('non_requise')->index();
            $table->foreignId('decharge_document_id')->nullable()->constrained('document_archives')->nullOnDelete();
            $table->timestamp('decharge_envoyee_le')->nullable();
            $table->timestamp('decharge_signee_le')->nullable();
            $table->string('decharge_signataire_ip', 45)->nullable();
            $table->string('decharge_signataire_agent')->nullable();
            // Le tracé de la signature, en image : la preuve de ce qui a été
            // dessiné, indépendamment du PDF qui l'incorpore.
            $table->longText('decharge_signature')->nullable();

            $table->foreignId('cree_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            // La question posée à chaque écran : qu'est-ce qui est encore
            // détenu aujourd'hui ? (date_restitution NULL)
            $table->index(['personnel_id', 'date_restitution']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telephonie_attributions');
    }
};
