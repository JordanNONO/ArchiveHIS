<?php

namespace App\Jobs;

use App\Mail\BulletinPaieMail;
use App\Models\EnvoiBulletinPaie;
use App\Models\Personnels;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

/**
 * Envoie UN bulletin de paie à UN salarié — dispatché une fois par
 * destinataire depuis BulletinPaieController::envoyer(), pour que l'échec
 * d'un envoi (adresse invalide, boîte pleine) n'empêche jamais les autres de
 * partir. Chaque job met à jour sa propre ligne EnvoiBulletinPaie, qui
 * reste la source de vérité pour l'écran de suivi.
 */
class EnvoyerBulletinPaie implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    // Pas de $tries : chaque échec est capturé et consigné sur sa ligne
    // (statut 'echec') plutôt que relancé automatiquement par la file —
    // un ré-essai se décide depuis l'écran de suivi, pas en silence.
    public function __construct(public int $envoiId)
    {
    }

    public function handle(): void
    {
        $envoi = EnvoiBulletinPaie::with('document')->find($this->envoiId);
        // Ligne supprimée entre temps (corbeille d'un vieux suivi) ou déjà
        // traitée par un essai précédent : rien à refaire.
        if (!$envoi || $envoi->statut !== 'en_attente') {
            return;
        }

        try {
            if (!$envoi->document) {
                throw new \RuntimeException('Le bulletin a été supprimé entre le moment du clic et son envoi.');
            }

            $personnel = Personnels::find($envoi->personnel_id);
            $prenom = $personnel?->prenom ?: 'Bonjour';
            $libelleMois = ucfirst(\Carbon\Carbon::parse($envoi->mois)->locale('fr')->isoFormat('MMMM YYYY'));

            Mail::to($envoi->mail_utilise)->send(new BulletinPaieMail($envoi->document, $prenom, $libelleMois));

            $envoi->update(['statut' => 'envoye', 'envoye_le' => now(), 'erreur' => null]);
        } catch (\Throwable $e) {
            report($e);
            $envoi->update(['statut' => 'echec', 'erreur' => mb_substr($e->getMessage(), 0, 500)]);
        }
    }
}
