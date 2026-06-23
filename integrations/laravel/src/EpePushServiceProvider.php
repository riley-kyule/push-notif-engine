<?php

namespace EPE\LaravelStarter;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\HttpFoundation\Response;

final class EpePushServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/epe-push.php', 'epe-push');
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__ . '/../resources/views', 'epe-push');
        $this->registerRoutes();

        $this->publishes([
            __DIR__ . '/../config/epe-push.php' => config_path('epe-push.php'),
            __DIR__ . '/../resources/views/bootstrap.blade.php' => resource_path('views/vendor/epe-push/bootstrap.blade.php'),
        ], 'epe-push-assets');
    }

    // No manual file publishing required for these three — manifest.json and
    // push-sw.js are generated from config on every request (so changing config
    // takes effect immediately, no stale published file to forget about), and
    // epe-sdk.js is served straight from the package's vendored copy. This is
    // what makes the package "install and go" rather than a starter you wire up
    // by hand — mirrors how the WordPress plugin serves these from its own hooks.
    private function registerRoutes(): void
    {
        $config = $this->app['config']->get('epe-push', []);
        $manifestUrl = $config['manifest_url'] ?? '/manifest.json';
        $serviceWorkerUrl = $config['service_worker_url'] ?? '/push-sw.js';

        Route::get($manifestUrl, static function (): Response {
            return new Response(EpePush::manifestJson(), 200, ['Content-Type' => 'application/manifest+json']);
        });

        Route::get($serviceWorkerUrl, static function (): Response {
            return new Response(EpePush::serviceWorkerScript(), 200, ['Content-Type' => 'application/javascript']);
        });

        Route::get('/assets/epe-sdk.js', static function (): Response {
            $sdk = file_get_contents(__DIR__ . '/../resources/vendor-assets/epe-sdk.js');

            return new Response($sdk === false ? '' : $sdk, 200, ['Content-Type' => 'application/javascript']);
        });
    }
}
