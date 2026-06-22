<?php

namespace EPE\LaravelStarter;

use Illuminate\Support\ServiceProvider;

final class EpePushServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/epe-push.php', 'epe-push');
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__ . '/../resources/views', 'epe-push');

        $this->publishes([
            __DIR__ . '/../config/epe-push.php' => config_path('epe-push.php'),
            __DIR__ . '/../resources/views/bootstrap.blade.php' => resource_path('views/vendor/epe-push/bootstrap.blade.php'),
        ], 'epe-push-assets');
    }
}
