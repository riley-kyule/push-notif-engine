<?php

namespace EPE\LaravelStarter;

final class EpePush
{
    public static function config(): array
    {
        return config('epe-push', []);
    }

    public static function bootstrapConfig(): array
    {
        $config = self::config();

        return [
            'apiUrl' => $config['api_url'] ?? '',
            'siteKey' => $config['site_key'] ?? '',
            'serviceWorkerUrl' => $config['service_worker_url'] ?? '/push-sw.js',
            'manifestUrl' => $config['manifest_url'] ?? '/manifest.json',
            'iconUrl' => $config['icon_url'] ?? '/icons/icon-192.png',
            'appName' => $config['app_name'] ?? config('app.name'),
            'themeColor' => $config['theme_color'] ?? '#111111',
        ];
    }
}
