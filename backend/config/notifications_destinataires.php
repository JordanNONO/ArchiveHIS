<?php

/*
|--------------------------------------------------------------------------
| Qui reçoit quoi — LE tableau des règles d'envoi des notifications
|--------------------------------------------------------------------------
|
| Chaque type de notification part vers un ou plusieurs "publics", toujours
| les mêmes six (voir App\Services\DestinatairesNotification) :
|
|   concernes      la/les personnes désignées sur l'appel, le document...
|   auteur         celui qui a pris l'appel / déposé le document
|   service        les membres du service lié (RH, Administratif...)
|   valideurs      ceux qui peuvent agir dessus (droit de valider, scopé au service)
|   admins         Administrateurs et Super Administrateurs
|   equipe_appels  accès au registre des appels (gerer_appels)
|
| `publics` : envoyé à chacun d'eux (sans doublon : quelqu'un à la fois
| concerné et admin ne reçoit qu'UNE notification).
| `secours` : utilisé seulement si `publics` ne donne personne (ex. un appel
| où personne n'est désigné).
| `libelle` / `description` : affichés sur la page « Qui reçoit quoi ».
|
| Changer une règle = changer une ligne ici, nulle part ailleurs.
|
*/

return [

    'appel' => [
        'libelle' => 'Nouvel appel',
        'description' => 'Un appel vient d\'être noté au registre.',
        'publics' => ['concernes'],
        'secours' => ['equipe_appels'],
    ],

    'appel_rappel' => [
        'libelle' => 'Appel non traité (4 h)',
        'description' => 'Relance automatique ou manuelle d\'un appel pas encore traité.',
        'publics' => ['concernes', 'auteur'],
        'secours' => ['equipe_appels'],
    ],

    'courrier' => [
        'libelle' => 'Courrier en retard',
        'description' => 'Courrier entrant toujours en attente (deadline dépassée ou 7 jours).',
        'publics' => ['service', 'admins'],
        'secours' => [],
    ],

    'a_valider' => [
        'libelle' => 'Document à valider',
        'description' => 'Un document vient d\'être déposé et attend une validation.',
        'publics' => ['valideurs', 'admins'],
        'secours' => [],
    ],

    'archive_info' => [
        'libelle' => 'Document archivé (déjà traité)',
        'description' => 'Un document a été archivé directement, rien à valider.',
        'publics' => ['valideurs', 'admins'],
        'secours' => [],
    ],

    'statut' => [
        'libelle' => 'Statut d\'un document changé',
        'description' => 'Validé, rejeté... prévient celui qui l\'a déposé.',
        'publics' => ['auteur'],
        'secours' => [],
    ],

    'correction_en_retard' => [
        'libelle' => 'Correction en retard',
        'description' => 'Un document rejeté n\'a pas été corrigé à temps.',
        'publics' => ['auteur', 'valideurs'],
        'secours' => [],
    ],

    'delai_depasse' => [
        'libelle' => 'Délai de workflow dépassé',
        'description' => 'Une étape de suivi vient de passer au rouge.',
        'publics' => ['admins'],
        'secours' => [],
    ],

    'pai_rappel' => [
        'libelle' => 'PAI : rappel d\'objectif',
        'description' => 'Objectif de PAI bientôt à échéance.',
        'publics' => ['concernes'],
        'secours' => [],
    ],

    'pai_en_retard' => [
        'libelle' => 'PAI : objectif en retard',
        'description' => 'Objectif de PAI dont l\'échéance est dépassée.',
        'publics' => ['concernes'],
        'secours' => [],
    ],

    'pai_escalade' => [
        'libelle' => 'PAI : escalade',
        'description' => 'Retard de PAI persistant sans action du responsable.',
        'publics' => ['admins'],
        'secours' => [],
    ],

    'renouvellement_essai' => [
        'libelle' => 'Renouvellement de période d\'essai',
        'description' => 'Une période d\'essai arrive à son terme.',
        'publics' => ['service', 'admins'],
        'secours' => [],
    ],

];
