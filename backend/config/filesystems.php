<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Disque de stockage des documents archivés
    |--------------------------------------------------------------------------
    |
    | En production, les documents sont stockés sur le serveur SFTP de HIS.
    | En local/développement, sans serveur SFTP réel disponible, on peut
    | basculer sur le disque "local" via DOCUMENT_STORAGE_DISK dans .env.
    |
    */

    'document_disk' => env('DOCUMENT_STORAGE_DISK', 'sftp'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app'),
            'throw' => false,
        ],

        // Sauvegardes automatiques (voir config/backup.php) — volontairement HORS
        // du dossier du projet, pour survivre même à une suppression accidentelle
        // du dossier applicatif entier. C:\ est le seul disque réellement utilisable
        // sur cette machine (le lecteur D: n'a aucun média inséré) ; si un vrai
        // disque externe/secondaire est branché plus tard, changer ce chemin.
        'local_backup' => [
            'driver' => 'local',
            'root' => env('BACKUP_LOCAL_PATH', 'C:\\HIS-Backups'),
            'throw' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL') . '/storage',
            'visibility' => 'public',
            'throw' => false,
        ],

        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            'throw' => false,
        ],

        'sftp' => [
            'driver' => 'sftp',
            'host' => env('SFTP_HOST'),
            'username' => env('SFTP_USERNAME'),
            'password' => env('SFTP_PASSWORD'),
            'port' => intval( env('SFTP_PORT', 22)),
            'root' => env('SFTP_ROOT', '/home/cisco'),
            'visibility' => 'public',
            'permPublic'=>0755,
            'directoryPerm'=>0755
        ],

        /*'smb' => [
            'driver' => 'custom',
            'via' => \App\Filesystem\CustomSmbAdapter::class,
            'host' => env('SMB_HOST'),
            'username' => env('SMB_USERNAME'),
            'password' => env('SMB_PASSWORD'),
            'workgroup' => env('SMB_WORKGROUP'),
            'share' => env('SMB_SHARE'),
            'path_prefix' => env('SMB_PATH_PREFIX', ''),
        ],*/

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
