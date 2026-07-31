<?php

namespace App\Mail;

use App\Models\DocumentArchive;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Partage externe sécurisé : contrairement à DocumentSharedMail (partages internes),
 * le fichier n'est jamais joint à l'email — seul un lien vers l'espace de
 * consultation dédié est envoyé, protégé par un code à usage unique (voir
 * PartageExterneController).
 */
class DocumentSharedExternalMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public DocumentArchive $document,
        public string $expediteurNom,
        public ?string $messagePersonnel,
        public string $lien,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->expediteurNom} vous a transmis un document — Hetep Iaout Services",
        );
    }

    public function content(): Content
    {
        $extension = strtoupper(pathinfo($this->document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION)) ?: 'FICHIER';

        return new Content(
            view: 'emails.document-shared-externe',
            with: [
                'document' => $this->document,
                'expediteurNom' => $this->expediteurNom,
                'messagePersonnel' => $this->messagePersonnel,
                'lien' => $this->lien,
                'extension' => $extension,
            ],
        );
    }
}
