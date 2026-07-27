<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PersonnelCredentialsMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $prenom,
        public string $email,
        public string $motDePasse,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Votre compte HIS Archivage a été créé',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.personnel-credentials',
            with: [
                'prenom' => $this->prenom,
                'email' => $this->email,
                'motDePasse' => $this->motDePasse,
            ],
        );
    }
}
