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

// Sauvegarde automatique (base de données + documents), hybride disque local +
// cloud si configuré — voir config/backup.php. Nettoyage juste après pour ne
// garder que les 2 dernières semaines.
Schedule::command('backup:run')->dailyAt('02:00');
Schedule::command('backup:clean')->dailyAt('02:30');
