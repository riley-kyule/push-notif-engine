export interface NodePushStarterConfig {
  apiUrl: string;
  siteKey: string;
  appName: string;
  iconUrl: string;
  themeColor: string;
  serviceWorkerUrl?: string;
  manifestUrl?: string;
  sdkUrl?: string;
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function buildBootstrapSnippet(config: NodePushStarterConfig): string {
  const payload = {
    apiUrl: config.apiUrl,
    siteKey: config.siteKey,
    serviceWorkerUrl: config.serviceWorkerUrl ?? "/push-sw.js",
    manifestUrl: config.manifestUrl ?? "/manifest.json",
    iconUrl: config.iconUrl,
    appName: config.appName,
    themeColor: config.themeColor,
  };

  return [
    "<script>",
    `  window.ExoticPushEngineConfig = ${toJson(payload)};`,
    "</script>",
    `<script defer src="${config.sdkUrl ?? "/assets/epe-sdk.js"}"></script>`,
  ].join("\n");
}

export function buildManifest(config: NodePushStarterConfig): string {
  return toJson({
    name: config.appName,
    short_name: config.appName.slice(0, 12),
    display: "standalone",
    theme_color: config.themeColor,
    background_color: "#ffffff",
    scope: "/",
    start_url: "/",
    icons: [{ src: config.iconUrl, sizes: "192x192", type: "image/png" }],
  });
}

// Mirrors the WordPress plugin's service worker: flat payload shape,
// delivery/click acknowledgement, image + action buttons, and a
// postMessage so open pages can refresh the bell badge live.
export function buildServiceWorkerScript(config: NodePushStarterConfig): string {
  const appName = JSON.stringify(config.appName);
  const iconUrl = JSON.stringify(config.iconUrl);

  return `self.addEventListener('install', (event) => {
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
  const title = payload.title || ${appName};
  const options = {
    body: payload.body || '',
    icon: payload.icon || ${iconUrl},
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
`;
}
