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
Schedule::command('pai:synchroniser-hissap')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('courriers:relancer')->everyFifteenMinutes();
Schedule::command('appels:relancer')->everyFifteenMinutes();
// Rappel de renouvellement de période d'essai (voir RelancerRenouvellementEssai)
// — basé sur une date, pas besoin d'une fréquence fine comme les autres
// rappels ci-dessus. 10h (pas minuit) pour arriver pendant la journée de
// travail, pas pendant la nuit.
Schedule::command('fluctuationRh:relancer-essai')->dailyAt('10:00');

// RETIRÉ (inactivite:alerter) : annonçait une coupure côté serveur qui a été
// désactivée (voir AuthPersonnelMiddleware) après avoir bloqué un compte en
// production — l'avertir maintenant serait juste une fausse alerte.

// Sauvegarde automatique (base de données + documents), hybride disque local +
// cloud si configuré — voir config/backup.php. Nettoyage juste après pour ne
// garder que les 2 dernières semaines.
Schedule::command('backup:run')->dailyAt('02:00');
Schedule::command('backup:clean')->dailyAt('02:30');

// Cache local des documents (voir DocumentController::lireAvecCache()) — ne
// grossit jamais indéfiniment, purge des fichiers non consultés depuis 30 jours.
Schedule::command('documents:nettoyer-cache')->daily();

// Filet de sécurité pour l'analyse IA (texte_extrait) : store()/
// remplacerFichier() dans DocumentController la déclenchent déjà
// automatiquement à chaque dépôt/remplacement, mais un document peut encore
// rester sans texte (clé API absente au moment du dépôt, échec ponctuel de la
// file d'attente...) — repasse chaque nuit sur ce qu'il en reste.
Schedule::command('documents:analyser-ia-retroactif')->dailyAt('04:00');

// Résumé d'activité du mois précédent, aux administrateurs et comptes
// consultation — voir EnvoyerRapportActiviteMensuel. Après la sauvegarde de
// 2h/2h30 pour ne pas les faire concourir sur la même fenêtre nocturne.
Schedule::command('rapport:mensuel')->monthlyOn(1, '03:00');
