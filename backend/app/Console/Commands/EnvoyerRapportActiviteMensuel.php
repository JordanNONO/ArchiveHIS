<?php

namespace App\Console\Commands;

use App\Enums\StatutDocument;
use App\Mail\RapportActiviteMensuelMail;
use App\Models\DocumentArchive;
use App\Models\HistoriqueStatut;
use App\Models\PaiObjectif;
use App\Models\SuiviDelai;
use App\Models\Utilisateurs;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Résumé d'activité mensuel envoyé aux comptes Administrateur et Consultation
 * (Viewer — précisément conçu comme "observateur transverse", voir
 * Utilisateurs::estViewer()) — pour avoir une vue d'ensemble régulière sans
 * avoir à aller consulter la page Statistiques.
 *
 * Porte sur le mois CALENDAIRE PRÉCÉDENT : planifié le 1er du mois (voir
 * routes/console.php), donc le mois en cours vient tout juste de commencer
 * et n'a presque rien à montrer.
 */
class EnvoyerRapportActiviteMensuel extends Command
{
    protected $signature = 'rapport:mensuel';

    protected $description = "Envoie le rapport d'activité mensuel aux administrateurs et comptes consultation";

    public function handle(): int
    {
        $debut = now()->subMonthNoOverflow()->startOfMonth();
        $fin = now()->subMonthNoOverflow()->endOfMonth();
        $libellePeriode = $debut->translatedFormat('F Y');

        $documentsDeposes = DocumentArchive::whereBetween('created_at', [$debut, $fin])->count();

        $documentsValides = HistoriqueStatut::where('nouveau_statut', StatutDocument::VALIDE_ET_TRAITE->value)
            ->whereBetween('date_changement', [$debut, $fin])
            ->count();

        $documentsRejetes = HistoriqueStatut::where('nouveau_statut', StatutDocument::INCOMPLET_REJETE->value)
            ->whereBetween('date_changement', [$debut, $fin])
            ->count();

        $documentsEnAttente = DocumentArchive::whereIn('status_doc', [
            StatutDocument::SOUMIS->value,
            StatutDocument::TRANSMIS_AU_SERVICE->value,
            StatutDocument::EN_COURS_DE_TRAITEMENT->value,
        ])->count();

        $courriersEntrants = DocumentArchive::where('sens_courrier', 'entrant')
            ->whereBetween('created_at', [$debut, $fin])
            ->count();

        $courriersSortants = DocumentArchive::where('sens_courrier', 'sortant')
            ->whereBetween('created_at', [$debut, $fin])
            ->count();

        $paiObjectifsEnRetard = PaiObjectif::where('fait', false)
            ->where('echeance', '<', now())
            ->count();

        $suivisDelaisRouge = SuiviDelai::whereNull('termine_le')
            ->where('niveau_alerte', 'ROUGE')
            ->count();

        $destinataires = Utilisateurs::whereHas('roles', fn ($q) => $q->whereIn('nom', ['Administrator', 'Viewer']))
            ->whereNotNull('mail')
            ->get();

        foreach ($destinataires as $destinataire) {
            Mail::to($destinataire->mail)->send(new RapportActiviteMensuelMail(
                $libellePeriode,
                $documentsDeposes,
                $documentsValides,
                $documentsRejetes,
                $documentsEnAttente,
                $courriersEntrants,
                $courriersSortants,
                $paiObjectifsEnRetard,
                $suivisDelaisRouge,
            ));
        }

        $this->info("Rapport d'activité de {$libellePeriode} envoyé à {$destinataires->count()} destinataire(s).");

        return self::SUCCESS;
    }
}
