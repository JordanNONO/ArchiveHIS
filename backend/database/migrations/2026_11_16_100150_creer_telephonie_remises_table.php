<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Une remise est un ÉVÉNEMENT : ce qu'on confie à quelqu'un un jour donné, et
 * ce qu'il reconnaît avoir reçu en signant. Elle peut couvrir un téléphone,
 * une ligne, ou les deux — chacun devenant une détention (voir
 * telephonie_detentions).
 *
 * Pourquoi l'événement est séparé des détentions : un salarié dont le
 * téléphone casse en reçoit un autre et garde son numéro. Il signe alors une
 * décharge pour le nouvel appareil seulement, pendant que sa ligne continue
 * sans interruption. Une décharge par objet serait absurde à signer, une
 * décharge collée à un couple téléphone+ligne obligerait à resigner le numéro
 * à chaque panne.
 *
 * Les colonnes de décharge sont la preuve, pas la décoration : un PDF portant
 * une image de signature ne prouve rien sans l'horodatage, l'adresse d'où
 * elle est partie et le tracé conservé à part.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telephonie_remises', function (Blueprint $table) {
            $table->id();
            // Nullable comme partout ici : personnels n'a pas de SoftDeletes,
            // et perdre la trace d'une remise parce qu'une fiche a été
            // supprimée irait contre la raison d'être du module.
            $table->foreignId('personnel_id')->nullable()->constrained('personnels')->nullOnDelete();
            $table->string('salarie_nom')->nullable();

            $table->date('date_remise')->index();
            $table->boolean('avec_chargeur')->default(false);
            $table->boolean('avec_coque')->default(false);
            $table->text('observations')->nullable();

            // non_requise | a_signer | signee | refusee
            // "non_requise" couvre la reprise de l'existant : ces téléphones
            // sont déjà distribués, réclamer une décharge rétroactive à
            // dix-huit personnes ferait abandonner la reprise avant la
            // troisième ligne.
            $table->string('decharge_statut', 20)->default('non_requise')->index();
            $table->foreignId('decharge_document_id')->nullable()->constrained('document_archives')->nullOnDelete();
            $table->timestamp('decharge_envoyee_le')->nullable();
            $table->timestamp('decharge_signee_le')->nullable();
            $table->string('decharge_signataire_ip', 45)->nullable();
            $table->string('decharge_signataire_agent')->nullable();
            $table->longText('decharge_signature')->nullable();

            $table->foreignId('cree_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telephonie_remises');
    }
};
