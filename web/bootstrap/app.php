<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

$app = Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withCommands([
        __DIR__.'/../app/Console/Commands',
    ])
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->web(append: [\App\Http\Middleware\HandleInertiaRequests::class]);
        $middleware->statefulApi();
        $middleware->prependToGroup('api', \App\Http\Middleware\Cors::class);
        $middleware->alias([
            'transactions.unlocked' => \App\Http\Middleware\EnsureTransactionsUnlocked::class,
        ]);

        // ✅ Exclude all API routes from CSRF
        $middleware->validateCsrfTokens(except: [
            'api/*',
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();

if (! is_file($app->environmentFilePath()) && is_file($app->environmentPath().'/.env.local')) {
    $app->loadEnvironmentFrom('.env.local');
}

return $app;
