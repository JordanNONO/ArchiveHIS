<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Purge les copies en cache local des documents (voir
 * DocumentController::lireAvecCache()) non consultées depuis 30 jours — le
 * cache accélère les ouvertures répétées sans faire grossir indéfiniment le
 * disque du VPS, le stockage de référence restant le serveur SFTP.
 */
class NettoyerCacheDocuments extends Command
{
    private const JOURS_INACTIVITE = 30;

    protected $signature = 'documents:nettoyer-cache';

    protected $description = "Supprime les copies en cache local des documents non consultées depuis 30 jours";

    public function handle(): int
    {
        $disque = Storage::disk('local');
        if (!$disque->exists('cache_documents')) {
            $this->info('Aucun cache à nettoyer.');
            return self::SUCCESS;
        }

        $seuil = now()->subDays(self::JOURS_INACTIVITE)->getTimestamp();
        $supprimes = 0;

        foreach ($disque->allFiles('cache_documents') as $fichier) {
            if ($disque->lastModified($fichier) < $seuil) {
                $disque->delete($fichier);
                $supprimes++;
            }
        }

        $this->info("{$supprimes} fichier(s) retiré(s) du cache.");
        return self::SUCCESS;
    }
}
