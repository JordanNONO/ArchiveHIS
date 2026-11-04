<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Annonces à la paie — notes officielles adressées au cabinet de paie avec
 * leur justificatif, à côté des lignes de fluctuation du mois : changement de
 * RIB, d'adresse, de situation familiale, de mutuelle, ou information
 * générale. Ce n'est pas un élément variable de paie (pas d'heures ni de
 * montant) mais un changement de dossier à répercuter, d'où une table à part
 * plutôt qu'une section de plus dans fluctuations_rh.
 *
 * Chaque annonce suit son propre circuit, indépendant de celui du mois :
 * brouillon -> à transmettre -> transmis -> lu par la paie.
 *
 * `donnees` (ancienne valeur, nouvelle valeur, et selon le type la banque...)
 * est chiffrée comme donnees_hissap et protocole ailleurs : on y trouve des
 * IBAN et des situations familiales.
 *
 * La section "dossier" (Mise à jour des dossiers) de fluctuations_rh faisait
 * double emploi : ses lignes deviennent des annonces de type "info" et la
 * section disparaît (voir FluctuationRh::SECTIONS).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('annonces_paie', function (Blueprint $table) {
            $table->id();
            $table->date('mois')->index();
            $table->string('type', 30)->index();
            // null = annonce générale, qui concerne tout le personnel.
            $table->string('salarie')->nullable();
            $table->date('date_effet')->nullable();
            $table->longText('donnees')->nullable();
            $table->text('message')->nullable();
            $table->string('piece_jointe')->nullable();
            $table->string('piece_jointe_nom')->nullable();
            $table->string('statut', 20)->default('brouillon')->index();
            $table->boolean('inclure_export')->default(true);
            $table->timestamp('transmis_le')->nullable();
            $table->foreignId('transmis_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamp('lu_le')->nullable();
            $table->foreignId('utilisateur_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->foreignId('modifie_par_id')->nullable()->constrained('utilisateurs')->nullOnDelete();
            $table->timestamps();
        });

        // Reprise des lignes "Mise à jour des dossiers" : l'observation
        // saisie devient le texte de l'annonce. Insertion directe (pas via le
        // modèle) pour rester indépendant du code applicatif ; `donnees` est
        // donc laissée vide, le texte vivant dans `message`.
        $lignes = DB::table('fluctuations_rh')->where('section', 'dossier')->get();
        foreach ($lignes as $ligne) {
            DB::table('annonces_paie')->insert([
                'mois' => $ligne->mois,
                'type' => 'info',
                'salarie' => $ligne->salarie,
                'date_effet' => $ligne->date_debut,
                'message' => trim(($ligne->motif ? $ligne->motif . ' — ' : '') . ($ligne->observations ?? '')) ?: null,
                'statut' => 'brouillon',
                'inclure_export' => true,
                'utilisateur_id' => $ligne->utilisateur_id,
                'modifie_par_id' => $ligne->modifie_par_id,
                'created_at' => $ligne->created_at,
                'updated_at' => $ligne->updated_at,
            ]);
        }

        DB::table('fluctuations_rh')->where('section', 'dossier')->delete();
    }

    public function down(): void
    {
        // Les annonces issues de l'ancienne section y retournent ; celles
        // créées depuis le nouvel écran n'ont pas d'équivalent et sont
        // perdues — c'est le prix d'un retour en arrière assumé.
        $annonces = DB::table('annonces_paie')->where('type', 'info')->get();
        foreach ($annonces as $annonce) {
            DB::table('fluctuations_rh')->insert([
                'mois' => $annonce->mois,
                'section' => 'dossier',
                'salarie' => $annonce->salarie ?? '—',
                'date_debut' => $annonce->date_effet,
                'observations' => $annonce->message,
                'utilisateur_id' => $annonce->utilisateur_id,
                'modifie_par_id' => $annonce->modifie_par_id,
                'created_at' => $annonce->created_at,
                'updated_at' => $annonce->updated_at,
            ]);
        }

        Schema::dropIfExists('annonces_paie');
    }
};
