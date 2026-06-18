import type { SiteSummary } from "./sites.utils";

function escapeForTemplate(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
}

export function buildSdkSnippet(site: SiteSummary): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://api.exoticpush.local/api";
  const config = {
    apiUrl,
    siteKey: site.id,
    vapidPublicKey: site.vapidPublicKey,
    serviceWorkerUrl: `${new URL(site.url).origin}/push-sw.js`,
    manifestUrl: `${new URL(site.url).origin}/manifest.json`,
    iconUrl: "",
    appName: site.name,
  };

  return [
    "<script>",
    "  window.ExoticPushEngineConfig = " + JSON.stringify(config, null, 2) + ";",
    "  (function () {",
    "    var script = document.createElement('script');",
    `    script.src = ${JSON.stringify(`${new URL(site.url).origin}/assets/epe-sdk.js`)};`,
    "    script.defer = true;",
    "    document.head.appendChild(script);",
    "  })();",
    "</script>",
  ].join("\n");
}

export function buildServiceWorkerAsset(site: SiteSummary): string {
  const appName = escapeForTemplate(site.name);
  const vapidPublicKey = escapeForTemplate(site.vapidPublicKey ?? "");
  return `self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const EPE_SITE_VAPID_PUBLIC_KEY = \`${vapidPublicKey}\`;

function resolvePayload(data) {
  if (!data) {
    return {};
  }
  if (data.type === 'browser-push-demo' && data.notification) {
    return data.notification;
  }
  if (typeof data.json === 'function') {
    try {
      return data.json();
    } catch {
      return {};
    }
  }
  return data.notification || data;
}

function showPushNotification(payload) {
  const title = payload.title || \`${appName}\`;
  const options = {
    body: payload.body || '',
    icon: payload.icon || undefined,
    image: payload.image || undefined,
    data: {
      url: payload.url || '/',
    },
    actions: Array.isArray(payload.buttons)
      ? payload.buttons.slice(0, 2).map((button) => ({ action: button.url, title: button.label }))
      : [],
  };

  return self.registration.showNotification(title, options);
}

function acknowledgeDelivery(payload) {
  if (!payload.deliveryId || !payload.ackUrl) {
    return Promise.resolve();
  }

  return fetch(payload.ackUrl, {
    method: 'POST',
  }).catch(() => undefined);
}

self.addEventListener('push', (event) => {
  const payload = resolvePayload(event.data);
  event.waitUntil(Promise.all([showPushNotification(payload), acknowledgeDelivery(payload)]));
});

self.addEventListener('message', (event) => {
  const payload = resolvePayload(event.data);
  if (!payload || (!payload.title && !payload.body && !payload.url)) {
    return;
  }

  event.waitUntil(showPushNotification(payload));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
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
    })
  );
});
`;
}

export function buildManifestAsset(site: SiteSummary): string {
  const origin = new URL(site.url).origin;
  const manifest = {
    name: site.name,
    short_name: site.name,
    start_url: `${origin}/`,
    scope: `${origin}/`,
    display: "standalone",
    theme_color: "#1c1917",
    background_color: "#fafaf9",
    icons: [
      {
        src: `${origin}/icon.png`,
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };

  return JSON.stringify(manifest, null, 2);
}
