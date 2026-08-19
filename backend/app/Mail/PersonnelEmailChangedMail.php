<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Envoyée quand un administrateur change l'adresse de connexion d'un
 * personnel (voir PersonnelController::updateById()) — le mot de passe
 * n'étant jamais stocké en clair (seulement son empreinte), impossible de le
 * renvoyer tel quel comme à la création du compte (voir PersonnelCredentialsMail) :
 * on confirme juste le changement d'adresse, mot de passe inchangé.
 */
class PersonnelEmailChangedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $prenom,
        public string $nouvelEmail,
        public string $ancienEmail,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Votre adresse de connexion HIS Archivage a changé',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.personnel-email-changed',
            with: [
                'prenom' => $this->prenom,
                'nouvelEmail' => $this->nouvelEmail,
                'ancienEmail' => $this->ancienEmail,
            ],
        );
    }
}
