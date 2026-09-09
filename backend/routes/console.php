<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote')->hourly();

Schedule::command('delais:verifier')->everyFifteenMinutes();
Schedule::command('corrections:relancer')->everyFifteenMinutes();
Schedule::command('pai:verifier-retard')->everyFifteenMinutes();
Schedule::command('courriers:relancer')->everyFifteenMinutes();

// Sauvegarde automatique (base de données + documents), hybride disque local +
// cloud si configuré — voir config/backup.php. Nettoyage juste après pour ne
// garder que les 2 dernières semaines.
Schedule::command('backup:run')->dailyAt('02:00');
Schedule::command('backup:clean')->dailyAt('02:30');

// Cache local des documents (voir DocumentController::lireAvecCache()) — ne
// grossit jamais indéfiniment, purge des fichiers non consultés depuis 30 jours.
Schedule::command('documents:nettoyer-cache')->daily();

// Résumé d'activité du mois précédent, aux administrateurs et comptes
// consultation — voir EnvoyerRapportActiviteMensuel. Après la sauvegarde de
// 2h/2h30 pour ne pas les faire concourir sur la même fenêtre nocturne.
Schedule::command('rapport:mensuel')->monthlyOn(1, '03:00');
