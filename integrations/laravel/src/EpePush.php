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

    // Mirrors the WordPress plugin's service worker: flat payload shape,
    // delivery/click acknowledgement, image + action buttons, and a
    // postMessage so open pages can refresh the bell badge live. The
    // configured app name and icon fill in when a payload omits its own.
    public static function serviceWorkerScript(): string
    {
        $bootstrap = self::bootstrapConfig();
        $app_name = json_encode((string) $bootstrap['appName']);
        $icon_url = json_encode((string) $bootstrap['iconUrl']);

        return <<<JS
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function acknowledgeDelivery(payload) {
  if (!payload.deliveryId || !payload.ackUrl) {
    return Promise.resolve();
  }

  return fetch(payload.ackUrl, { method: 'POST' }).catch(() => undefined);
}

function acknowledgeClick(clickUrl) {
  if (!clickUrl) {
    return Promise.resolve();
  }

  return fetch(clickUrl, { method: 'POST' }).catch(() => undefined);
}

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || {$app_name};
  const options = {
    body: payload.body || '',
    icon: payload.icon || {$icon_url},
    image: payload.image || undefined,
    data: {
      url: payload.url || '/',
      clickUrl: payload.clickUrl || null,
    },
    actions: Array.isArray(payload.buttons)
      ? payload.buttons.slice(0, 2).map((button) => ({ action: button.url, title: button.label }))
      : [],
  };

  // Let any open pages know a push landed so the bell badge / recents tray
  // can refresh without a reload.
  const notifyOpenPages = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => client.postMessage({ type: 'epe:push-received' }));
    })
    .catch(() => undefined);

  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    acknowledgeDelivery(payload),
    notifyOpenPages,
  ]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  const clickUrl = event.notification.data && event.notification.data.clickUrl ? event.notification.data.clickUrl : null;
  event.waitUntil(
    Promise.all([
      acknowledgeClick(clickUrl),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return;
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      }),
    ])
  );
});
JS;
    }
}
