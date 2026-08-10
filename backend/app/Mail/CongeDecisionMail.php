<?php

namespace App\Mail;

use App\Models\DocumentArchive;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * PDF de demande de congés complété par le responsable secteur (section 3
 * "Décision de l'employeur" incrustée côté client, voir congesPdf.js) — envoyé
 * au demandeur juste après que decisionConges() ait remplacé le fichier et
 * fait transitionner le statut.
 */
class CongeDecisionMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public DocumentArchive $document,
        public string $nomSignataire,
        public ?string $motif = null,
    ) {
    }

    public function envelope(): Envelope
    {
        $accepte = $this->document->status_doc === 'VALIDE_ET_TRAITE';

        return new Envelope(
            subject: $accepte
                ? 'Votre demande de congés a été acceptée — Hetep Iaout Services'
                : 'Votre demande de congés a été traitée — Hetep Iaout Services',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.conge-decision',
            with: [
                'document' => $this->document,
                'nomSignataire' => $this->nomSignataire,
                'motif' => $this->motif,
                'accepte' => $this->document->status_doc === 'VALIDE_ET_TRAITE',
            ],
        );
    }

    public function attachments(): array
    {
        try {
            $contenu = $this->document->lireFichier();
        } catch (\Throwable $e) {
            report($e);
            return [];
        }

        return [
            Attachment::fromData(fn () => $contenu, $this->document->titre_document . '.pdf')
                ->withMime('application/pdf'),
        ];
    }
}
