<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Le mois auquel se rapporte un document — pour l'instant, seul le dépôt
 * groupé des bulletins de paie le renseigne (voir BulletinPaieController).
 *
 * Il n'existait jusqu'ici AUCUN champ structuré pour ça : le circuit existant
 * de "Demande de fiche de paie" (PaieForm.jsx) n'écrit le mois choisi que
 * dans le texte du titre ("Demande de fiche de paie — mars 2025"), jamais
 * dans une colonne — impossible donc de retrouver par requête "le bulletin
 * de Mars de telle personne", ce que l'envoi groupé par mail a besoin de
 * faire (demande explicite 2026-11-18 : "reconnaît directement le bulletin
 * du mois").
 *
 * Volontairement PAS une réutilisation de `file_create_date` : ce champ
 * porte déjà un autre sens (date de création du fichier / de la demande,
 * affiché tel quel dans DocumentList.jsx et DocView.jsx) sur tous les autres
 * formulaires de dépôt — le détourner pour porter "le mois concerné" aurait
 * rendu cet affichage existant incohérent ailleurs dans l'application.
 *
 * Stocké comme le 1er jour du mois (ex: 2025-03-01), jamais lu comme une
 * vraie date d'événement.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->date('mois_concerne')->nullable()->after('file_create_date')->index();
        });
    }

    public function down(): void
    {
        Schema::table('document_archives', function (Blueprint $table) {
            $table->dropColumn('mois_concerne');
        });
    }
};
