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

    // Generated, not published — there's no static manifest.json to keep in sync
    // with config changes. Mirrors the WordPress plugin's manifest output.
    public static function manifestJson(): string
    {
        $bootstrap = self::bootstrapConfig();

        return json_encode([
            'name' => $bootstrap['appName'],
            'short_name' => mb_substr((string) $bootstrap['appName'], 0, 12),
            'display' => 'standalone',
            'theme_color' => $bootstrap['themeColor'],
            'background_color' => '#ffffff',
            'scope' => '/',
            'start_url' => '/',
            'icons' => [
                ['src' => $bootstrap['iconUrl'], 'sizes' => '192x192', 'type' => 'image/png'],
            ],
        ], JSON_PRETTY_PRINT);
    }

    // The SDK posts to whatever ackUrl/clickUrl/url the push payload carries, so
    // this worker needs no per-site config beyond what's already in the payload —
    // it's identical across every site, generated for parity with the Node/WordPress
    // integrations rather than because Laravel needs anything site-specific here.
    public static function serviceWorkerScript(): string
    {
        return <<<'JS'
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const notification = payload.notification ?? {};
  const options = {
    body: notification.body ?? payload.body ?? '',
    icon: notification.icon ?? payload.icon ?? '/icons/icon-192.png',
    badge: notification.badge ?? payload.badge ?? '/icons/icon-192.png',
    data: {
      deliveryId: payload.deliveryId ?? null,
      ackUrl: payload.ackUrl ?? null,
      clickUrl: payload.clickUrl ?? null,
      url: notification.url ?? payload.url ?? '/',
    },
  };
  event.waitUntil(self.registration.showNotification(notification.title ?? payload.title ?? 'Notification', options));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(self.clients.openWindow(url));
});
JS;
    }
}
