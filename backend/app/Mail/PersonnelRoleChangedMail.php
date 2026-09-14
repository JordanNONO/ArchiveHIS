<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Envoyée quand un administrateur ajoute ou change le(s) rôle(s) d'un
 * compte (voir PersonnelController::updateById()). Comme le mot de passe
 * n'est jamais stocké en clair (voir PersonnelCredentialsMail), impossible
 * de rappeler l'ancien : un nouveau mot de passe est généré à cette
 * occasion et envoyé ici, exactement comme à la création du compte.
 */
class PersonnelRoleChangedMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $prenom,
        public string $email,
        public string $motDePasse,
        public array $anciensRoles,
        public array $nouveauxRoles,
        public ?string $explication,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Votre rôle sur HIS Archivage a changé',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.personnel-role-changed',
            with: [
                'prenom' => $this->prenom,
                'email' => $this->email,
                'motDePasse' => $this->motDePasse,
                'anciensRoles' => $this->anciensRoles,
                'nouveauxRoles' => $this->nouveauxRoles,
                'explication' => $this->explication,
                'titre' => 'Votre rôle a changé',
                'tag' => in_array('Administrator', $this->nouveauxRoles, true) ? 'NOTIF-ADMIN' : 'NOTIF-RÔLE',
            ],
        );
    }
}
