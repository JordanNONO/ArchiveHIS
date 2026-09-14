<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Résumé d'activité mensuel envoyé aux comptes Administrateur/Consultation
 * (voir EnvoyerRapportActiviteMensuel, planifié le 1er de chaque mois) —
 * mêmes chiffres que la page Statistiques, pour qu'un administrateur n'ait
 * pas besoin d'aller la consulter pour avoir une vue d'ensemble régulière.
 */
class RapportActiviteMensuelMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $libellePeriode,
        public int $documentsDeposes,
        public int $documentsValides,
        public int $documentsRejetes,
        public int $documentsEnAttente,
        public int $courriersEntrants,
        public int $courriersSortants,
        public int $paiObjectifsEnRetard,
        public int $suivisDelaisRouge,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Rapport d'activité — {$this->libellePeriode} — HIS Archivage",
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.rapport-activite-mensuel',
            with: [
                'libellePeriode' => $this->libellePeriode,
                'documentsDeposes' => $this->documentsDeposes,
                'documentsValides' => $this->documentsValides,
                'documentsRejetes' => $this->documentsRejetes,
                'documentsEnAttente' => $this->documentsEnAttente,
                'courriersEntrants' => $this->courriersEntrants,
                'courriersSortants' => $this->courriersSortants,
                'paiObjectifsEnRetard' => $this->paiObjectifsEnRetard,
                'suivisDelaisRouge' => $this->suivisDelaisRouge,
                'titre' => 'Rapport d\'activité mensuel',
                'tag' => 'NOTIF-RAPPORT',
                'signataire' => 'HIS Archivage',
            ],
        );
    }
}
