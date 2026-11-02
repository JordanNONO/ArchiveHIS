<?php

namespace App\Console\Commands;

use App\Models\DocumentArchive;
use App\Models\DocumentPieceJointe;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Supprime les messages vocaux (voir VoiceRecorder.jsx) 3 jours après leur
 * dépôt — demande explicite, retrait des enregistrements audio bruts qui ne
 * doivent pas rester indéfiniment accessibles. Le texte transcrit (déjà
 * enregistré dans le message/texte du document au moment de l'envoi, voir
 * ReclamationForm.jsx etc.) n'est jamais touché : seul le fichier audio brut
 * disparaît, le document archivé reste consultable.
 *
 * Deux cas selon le type de demande (voir VoiceRecorder.jsx/typesDemande.js) :
 * - Signalement : le vocal peut être LE fichier principal du document — le
 *   document reste (comme un document dont le fichier a été perdu, déjà géré
 *   partout dans l'appli), seul chemin_stockage_serveur est vidé.
 * - Réclamation/Congés/Prestation/Signalement : le vocal est une PIÈCE JOINTE
 *   au document (le fichier principal est le PDF récapitulatif) — la ligne
 *   document_pieces_jointes est supprimée entièrement, ses colonnes fichier
 *   étant NOT NULL (pas de "vidage" possible comme sur le document principal).
 *
 * Identifié par extension (webm/m4a/mp3/wav/ogg) : dans tout le reste de
 * l'appli, ces extensions ne désignent QUE le fichier produit par
 * VoiceRecorder (voir DocumentController::store(), $mimesAudio) — jamais un
 * autre type de pièce.
 */
class PurgerFichiersAudio extends Command
{
    private const JOURS_RETENTION = 3;

    private const EXTENSIONS_AUDIO = ['webm', 'm4a', 'mp3', 'wav', 'ogg'];

    protected $signature = 'documents:purger-audios';

    protected $description = "Supprime les messages vocaux (audio) déposés depuis plus de 3 jours, sans toucher au reste du document";

    public function handle(): int
    {
        $seuil = now()->subDays(self::JOURS_RETENTION);
        $disque = Storage::disk(config('filesystems.document_disk'));

        $documentsSupprimes = 0;
        DocumentArchive::whereNotNull('chemin_stockage_serveur')
            ->where('created_at', '<', $seuil)
            ->where(function ($q) {
                foreach (self::EXTENSIONS_AUDIO as $ext) {
                    $q->orWhere('chemin_stockage_serveur', 'like', "%.{$ext}");
                }
            })
            ->chunkById(100, function ($documents) use ($disque, &$documentsSupprimes) {
                foreach ($documents as $document) {
                    if ($disque->exists($document->chemin_stockage_serveur)) {
                        $disque->delete($document->chemin_stockage_serveur);
                    }
                    $document->update(['chemin_stockage_serveur' => null, 'nom_fichier_original' => null]);
                    $documentsSupprimes++;
                }
            });

        $piecesSupprimees = 0;
        DocumentPieceJointe::where('created_at', '<', $seuil)
            ->where(function ($q) {
                foreach (self::EXTENSIONS_AUDIO as $ext) {
                    $q->orWhere('chemin_stockage_serveur', 'like', "%.{$ext}");
                }
            })
            ->chunkById(100, function ($pieces) use ($disque, &$piecesSupprimees) {
                foreach ($pieces as $piece) {
                    if ($disque->exists($piece->chemin_stockage_serveur)) {
                        $disque->delete($piece->chemin_stockage_serveur);
                    }
                    $piece->delete();
                    $piecesSupprimees++;
                }
            });

        $this->info("{$documentsSupprimes} document(s) (fichier principal audio) et {$piecesSupprimees} pièce(s) jointe(s) audio supprimé(s).");
        return self::SUCCESS;
    }
}
