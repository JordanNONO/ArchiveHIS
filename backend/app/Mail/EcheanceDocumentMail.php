<?php

namespace App\Mail;

use App\Models\DocumentArchive;
use App\Notifications\EcheanceDocumentNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Version e-mail de EcheanceDocumentNotification — même texte, envoyé au
 * salarié concerné et à la RH (demande explicite 2026-11-22 : « par
 * notification et par e-mail »).
 */
class EcheanceDocumentMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public DocumentArchive $document,
        public int $joursRestants,
        public bool $pourLeSalarie,
        public string $nomSalarie,
    ) {
    }

    public function envelope(): Envelope
    {
        $sujet = $this->joursRestants < 0
            ? "Document expiré — {$this->document->titre_document}"
            : "Document à renouveler — {$this->document->titre_document}";

        if (!$this->pourLeSalarie) {
            $sujet .= " ({$this->nomSalarie})";
        }

        return new Envelope(subject: $sujet . ' — Hetep Iaout Services');
    }

    public function content(): Content
    {
        $extension = pathinfo($this->document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION);
        $base = rtrim(config('app.frontend_url', config('app.url')), '/');

        return new Content(
            view: 'emails.echeance-document',
            with: [
                'document' => $this->document,
                'pourLeSalarie' => $this->pourLeSalarie,
                'nomSalarie' => $this->nomSalarie,
                'quand' => EcheanceDocumentNotification::quand($this->joursRestants),
                'dateFin' => $this->document->date_fin_validite->format('d/m/Y'),
                'expire' => $this->joursRestants < 0,
                'lien' => $this->pourLeSalarie ? "{$base}/mes-documents" : "{$base}/view/{$this->document->id}/{$extension}",
                'titre' => $this->joursRestants < 0 ? 'Document expiré' : 'Document à renouveler',
                'tag' => 'NOTIF-ÉCHÉANCE',
            ],
        );
    }
}
