<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth'],

    'allowed_methods' => ['*'],
    'allowed-credentials'=> true,

    'allowed_origins' => ['http://localhost:3000', 'http://127.0.0.1:3000'],

    // Autorise l'accès depuis d'autres appareils du même réseau local (ex: téléphone
    // en test) dont l'adresse IP privée peut changer d'une session à l'autre (DHCP).
    'allowed_origins_patterns' => [
        '#^http://192\.168\.\d{1,3}\.\d{1,3}:3000$#',
        '#^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:3000$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => ['*'],

    'max_age' => 0,

    'supports_credentials' => true,

];
