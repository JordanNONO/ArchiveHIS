<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OtpCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $code, public int $dureeValiditeMinutes)
    {
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Votre code d\'accès — Hetep Iaout Services');
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.otp-code',
            with: [
                'code' => $this->code,
                'dureeValiditeMinutes' => $this->dureeValiditeMinutes,
            ],
        );
    }
}
