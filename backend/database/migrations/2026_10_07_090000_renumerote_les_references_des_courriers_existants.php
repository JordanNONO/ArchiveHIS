<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Bascule tous les courriers déjà archivés (CRE-MTLLYGTI0, CRS-MUWE0BX0...)
 * vers la méthode de référencement utilisée par le pôle administratif avant
 * HIS Archives (demande explicite, 2026-10-07) : CRE-260405 = 5e courrier
 * ENTRANT d'avril 2026, CRS-260405 = 5e SORTANT du même mois — compteurs
 * indépendants par sens. Même logique que
 * DocumentController::genererReferenceCourrier(), appliquée ici une fois
 * pour tout l'historique plutôt que seulement pour les nouveaux courriers.
 *
 * Date de référence : date_reception pour un entrant, date_envoi pour un
 * sortant, repli sur created_at si absente — jamais la date d'archivage dans
 * le logiciel, pour rester fidèle au registre papier. Au sein d'un même mois,
 * la séquence suit l'ordre chronologique de cette même date (ties départagés
 * par l'id, stable).
 */
return new class extends Migration
{
    public function up(): void
    {
        $courriers = DB::table('document_archives')
            ->whereNotNull('sens_courrier')
            ->orderBy('id')
            ->get(['id', 'sens_courrier', 'date_reception', 'date_envoi', 'created_at']);

        $compteurs = [];

        foreach ($courriers as $courrier) {
            $date = $courrier->sens_courrier === 'entrant'
                ? ($courrier->date_reception ?? $courrier->created_at)
                : ($courrier->date_envoi ?? $courrier->created_at);

            $anneeMois = \Carbon\Carbon::parse($date)->format('ym');
            $prefixe = $courrier->sens_courrier === 'entrant' ? 'CRE' : 'CRS';
            $cle = "{$prefixe}-{$anneeMois}";

            $compteurs[$cle] = ($compteurs[$cle] ?? 0) + 1;
            $sequence = str_pad($compteurs[$cle], 2, '0', STR_PAD_LEFT);

            DB::table('document_archives')
                ->where('id', $courrier->id)
                ->update(['code_reference' => "{$cle}{$sequence}"]);
        }
    }

    public function down(): void
    {
        // Volontairement pas de retour arrière automatique : les anciennes
        // références (CRE-MTLLYGTI0...) ne sont pas conservées avant
        // écrasement — une restauration demanderait une sauvegarde de la base
        // antérieure à cette migration.
    }
};
