<?php

use App\Http\Middleware\AuthPersonnelMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    // /broadcasting/auth doit passer par notre middleware JWT, pas par le groupe
    // 'web' par défaut (session) — cette appli est entièrement stateless, il n'y a
    // pas de table sessions en base.
    ->withBroadcasting(
        __DIR__.'/../routes/channels.php',
        attributes: ['middleware' => [AuthPersonnelMiddleware::class]],
    )
    ->withMiddleware(function (Middleware $middleware) {
        //
        // Le serveur de dev React fait office de relais HTTPS (voir config-overrides.js)
        // en avant du backend HTTP — sans ceci, les URL/signatures générées (liens
        // signés, canaux de diffusion) utiliseraient le mauvais hôte/schéma. '*' est
        // sans risque ici : jamais exposé au-delà du réseau local en développement.
        $middleware->trustProxies(
            at: '*',
            headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PORT | Request::HEADER_X_FORWARDED_PROTO,
        );
        $middleware->api(prepend:[AuthPersonnelMiddleware::class]);
        $middleware->alias([
            'permission' => \App\Http\Middleware\CheckPermissionMiddleware::class,
            'role' => \App\Http\Middleware\CheckRoleMiddleware::class,
        ]);
        $middleware->validateCsrfTokens(
            except: ['/api*']
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
