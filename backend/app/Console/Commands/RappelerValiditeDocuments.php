<?php

namespace App\Console\Commands;

use App\Mail\EcheanceDocumentMail;
use App\Models\DocumentArchive;
use App\Models\ServiceMetier;
use App\Models\Utilisateurs;
use App\Notifications\EcheanceDocumentNotification;
use App\Services\DestinatairesNotification;
use App\Services\EcheancesDocuments;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

/**
 * Rappels de fin de validité (titre de séjour, visite médicale,
 * formation...) — 60, 30 et 7 jours avant, puis le jour même, par
 * notification ET par e-mail, au salarié concerné et à la RH (demande
 * explicite 2026-11-22). Chaque palier n'est envoyé qu'une fois
 * (rappel_validite_palier) ; un document remplacé par un plus récent de la
 * même famille n'est plus rappelé (voir EcheancesDocuments::nonRemplaces()).
 */
class RappelerValiditeDocuments extends Command
{
    protected $signature = 'documents:rappeler-validite';

    protected $description = 'Prévient le salarié et la RH avant la fin de validité d\'un document (60, 30, 7 jours avant et le jour même)';

    public function handle(DestinatairesNotification $destinataires): int
    {
        $tous = DocumentArchive::with('typeDocument', 'personnelConcerne', 'utilisateur', 'categorieDocument')
            ->whereNotNull('date_fin_validite')
            ->whereDate('date_fin_validite', '>=', now()->subDays(EcheancesDocuments::OUBLI_APRES_JOURS)->toDateString())
            ->get();

        // Comparaison faite sur TOUS les documents datés, pas seulement ceux
        // proches de l'échéance : le nouveau titre (lointain) doit pouvoir
        // remplacer l'ancien (proche).
        $documentsDates = DocumentArchive::with('typeDocument')
            ->whereNotNull('date_fin_validite')
            ->get();
        $actifs = EcheancesDocuments::nonRemplaces($documentsDates)->pluck('id')->all();

        $idsRh = fn () => $destinataires->idsMembresService(ServiceMetier::where('code_service', 'RH')->value('id'));
        $envoyes = 0;

        foreach ($tous as $document) {
            if (!in_array($document->id, $actifs, true)) {
                continue;
            }
            if ($document->categorieDocument?->verrouille_par_utilisateur_id) {
                continue;
            }

            $jours = EcheancesDocuments::joursRestants($document);
            $palier = EcheancesDocuments::palierAtteint($jours);
            if ($palier === null) {
                continue;
            }
            // Déjà envoyé pour ce palier (ou un plus proche) : rien à faire.
            if ($document->rappel_validite_palier !== null && $document->rappel_validite_palier <= $palier) {
                continue;
            }

            $salarie = EcheancesDocuments::utilisateurConcerne($document);
            $nomSalarie = trim(($document->personnelConcerne?->prenom ?? '') . ' ' . ($document->personnelConcerne?->nom ?? ''))
                ?: ($salarie?->nom ?? $document->nom_personne_concernee ?? 'salarié');

            $contexte = [
                'concernes' => $salarie ? [$salarie->id] : [],
                'service' => $idsRh,
            ];

            $liste = $destinataires->resoudre('echeance_document', $contexte);
            foreach ($liste as $d) {
                /** @var Utilisateurs $u */
                $u = $d['utilisateur'];
                $pourLeSalarie = $d['public'] === 'concernes';
                $u->notify(new EcheanceDocumentNotification($document, $jours, $pourLeSalarie, $nomSalarie));

                if ($u->mail) {
                    try {
                        Mail::to($u->mail)->send(new EcheanceDocumentMail($document, $jours, $pourLeSalarie, $nomSalarie));
                    } catch (\Throwable $e) {
                        report($e);
                    }
                }
                $envoyes++;
            }

            $document->update(['rappel_validite_palier' => $palier]);
        }

        $this->info("Rappels de fin de validité envoyés : {$envoyes}.");

        return self::SUCCESS;
    }
}
