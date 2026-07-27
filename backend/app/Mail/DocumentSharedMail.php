<?php

namespace App\Mail;

use App\Models\DocumentArchive;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class DocumentSharedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public DocumentArchive $document,
        public string $expediteurNom,
        public ?string $messagePersonnel,
        public bool $isExternal,
        public ?string $serviceNom = null,
    ) {
    }

    public function envelope(): Envelope
    {
        $subject = match (true) {
            $this->isExternal => "{$this->expediteurNom} vous a transmis un document — Hetep Iaout Services",
            (bool) $this->serviceNom => "{$this->expediteurNom} a transmis un document au service {$this->serviceNom}",
            default => "{$this->expediteurNom} vous a partagé un document sur HIS Archivage",
        };

        return new Envelope(subject: $subject);
    }

    public function content(): Content
    {
        $extension = strtoupper(pathinfo($this->document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION)) ?: 'FICHIER';

        $couleurs = [
            'PDF' => ['bg' => '#FDECEC', 'fg' => '#DC2626'],
            'DOC' => ['bg' => '#E8EEF7', 'fg' => '#1B365D'],
            'DOCX' => ['bg' => '#E8EEF7', 'fg' => '#1B365D'],
            'XLS' => ['bg' => '#E7F6EC', 'fg' => '#16A34A'],
            'XLSX' => ['bg' => '#E7F6EC', 'fg' => '#16A34A'],
            'CSV' => ['bg' => '#E7F6EC', 'fg' => '#16A34A'],
            'PPT' => ['bg' => '#FDEEE1', 'fg' => '#EA580C'],
            'PPTX' => ['bg' => '#FDEEE1', 'fg' => '#EA580C'],
        ];

        return new Content(
            view: 'emails.document-shared',
            with: [
                'document' => $this->document,
                'expediteurNom' => $this->expediteurNom,
                'messagePersonnel' => $this->messagePersonnel,
                'isExternal' => $this->isExternal,
                'serviceNom' => $this->serviceNom,
                'extension' => $extension,
                'tailleLabel' => $this->formatTaille($this->document->taille),
                'typeCouleur' => $couleurs[$extension] ?? ['bg' => '#F1F2F4', 'fg' => '#6B7280'],
            ],
        );
    }

    private function formatTaille(?int $octets): ?string
    {
        if (!$octets) {
            return null;
        }

        $unites = ['o', 'Ko', 'Mo', 'Go'];
        $puissance = min((int) floor(log($octets, 1024)), count($unites) - 1);

        return round($octets / (1024 ** $puissance), 1) . ' ' . $unites[$puissance];
    }

    public function attachments(): array
    {
        try {
            $contenu = $this->document->lireFichier();
        } catch (\Throwable $e) {
            report($e);
            return [];
        }

        $extension = pathinfo($this->document->chemin_stockage_serveur, PATHINFO_EXTENSION);

        return [
            Attachment::fromData(fn () => $contenu, $this->document->titre_document . '.' . $extension)
                ->withMime($this->document->format_mime ?? 'application/octet-stream'),
        ];
    }
}
