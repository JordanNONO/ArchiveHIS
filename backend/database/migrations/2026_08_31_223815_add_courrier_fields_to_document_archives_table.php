<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Champs structurés du formulaire "Nouveau courrier" (entrant/sortant),
 * remplace le suivi fait jusqu'ici sur Google Sheets. Colonnes dédiées
 * (plutôt qu'un JSON générique) pour rester filtrables/triables nativement,
 * comme le reste des champs structurés de cette table (objet, echeance_traitement_le...).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->string('sens_courrier', 20)->nullable()->after('objet');
            $table->string('type_envoi', 100)->nullable();
            $table->string('numero_recommande')->nullable();
            $table->unsignedInteger('nombre_documents')->nullable();
            $table->date('date_envoi')->nullable();
            $table->date('date_reception')->nullable();
            $table->string('expediteur_nom')->nullable();
            $table->string('expediteur_adresse')->nullable();
            $table->string('destinataire_nom')->nullable();
            $table->string('destinataire_adresse')->nullable();
            $table->decimal('montant', 10, 2)->nullable();
            $table->string('etat_courrier', 30)->nullable();
            // Dédiée plutôt que de réutiliser echeance_traitement_le : ce champ-là est
            // auto-calculé depuis delai_jours par DocumentController::store() (voir plus
            // bas) et alimente le système de relance existant (RelancerCorrectionsEnRetard) —
            // une deadline saisie manuellement sur un courrier écraserait ce calcul.
            $table->date('deadline_courrier')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn([
                'sens_courrier',
                'type_envoi',
                'numero_recommande',
                'nombre_documents',
                'date_envoi',
                'date_reception',
                'expediteur_nom',
                'expediteur_adresse',
                'destinataire_nom',
                'destinataire_adresse',
                'montant',
                'etat_courrier',
                'deadline_courrier',
            ]);
        });
    }
};
