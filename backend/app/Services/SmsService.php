<?php

namespace App\Services;

use Twilio\Rest\Client;

class SmsService
{
    /**
     * Envoie un SMS. Retourne true si l'envoi a été accepté par Twilio, false sinon
     * (erreur journalisée mais jamais remontée à l'appelant : un SMS raté ne doit
     * pas empêcher la création du compte).
     */
    public function envoyer(string $telephone, string $message): bool
    {
        $numero = $this->normaliserEnE164($telephone);

        try {
            $client = new Client(config('services.twilio.sid'), config('services.twilio.auth_token'));

            $client->messages->create($numero, [
                'from' => config('services.twilio.from_number'),
                'body' => $message,
            ]);

            return true;
        } catch (\Throwable $e) {
            report($e);
            return false;
        }
    }

    /**
     * Convertit un numéro français local (0X XX XX XX XX) en E.164 (+33XXXXXXXXX).
     * Laisse inchangé un numéro déjà international (commence par +).
     */
    private function normaliserEnE164(string $telephone): string
    {
        $nettoye = preg_replace('/[\s.\-]/', '', $telephone);

        if (str_starts_with($nettoye, '+')) {
            return $nettoye;
        }

        if (str_starts_with($nettoye, '0')) {
            return '+33' . substr($nettoye, 1);
        }

        return $nettoye;
    }
}
