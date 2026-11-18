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
 * Le bulletin de paie d'un mois, en pièce jointe — demande explicite
 * 2026-11-18 (préféré à un lien de consultation : un bulletin français
 * contient des informations sensibles, mais la pièce jointe a été choisie
 * en connaissance de cause).
 *
 * Même gabarit visuel que DocumentSharedMail (emails.layout, même carte
 * fichier via partials.fichier) — pas un style à part : seul le texte
 * change, pour qu'un salarié reconnaisse un mail de HIS Archivage quel que
 * soit son contenu.
 *
 * PAS ShouldQueue, volontairement : il est déjà envoyé depuis l'intérieur
 * d'un job en file (voir EnvoyerBulletinPaie), un par destinataire. Le rendre
 * lui-même "à mettre en file" referait passer Mail::send() par une SECONDE
 * file — le job marquerait alors "envoyé" dès la mise en file, avant tout
 * envoi réel, et un vrai échec de livraison (adresse invalide...) ne
 * remonterait jamais jusqu'au statut suivi par l'écran de suivi.
 */
class BulletinPaieMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public DocumentArchive $document,
        public string $prenomSalarie,
        public string $libelleMois,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: "Bulletin de salaire — {$this->libelleMois}");
    }

    public function content(): Content
    {
        $extension = strtoupper(pathinfo($this->document->chemin_stockage_serveur ?? '', PATHINFO_EXTENSION)) ?: 'PDF';

        return new Content(
            view: 'emails.bulletin-paie',
            with: [
                'prenomSalarie' => $this->prenomSalarie,
                'libelleMois' => $this->libelleMois,
                'libelleMoisMinuscule' => mb_strtolower($this->libelleMois),
                'extension' => $extension,
                'tailleLabel' => $this->formatTaille($this->document->taille),
                'titre' => "Bulletin de salaire — {$this->libelleMois}",
                'tag' => 'PAIE',
                'signataire' => "L'Administration — Hetep Iaout Services",
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
            Attachment::fromData(fn () => $contenu, "Bulletin de salaire - {$this->libelleMois}.{$extension}")
                ->withMime($this->document->format_mime ?? 'application/octet-stream'),
        ];
    }
}
