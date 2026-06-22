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

export function buildServiceWorkerScript(config: NodePushStarterConfig): string {
  return [
    `const EPE_API_URL = ${JSON.stringify(config.apiUrl)};`,
    "self.addEventListener('install', () => self.skipWaiting());",
    "self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));",
    "self.addEventListener('push', (event) => {",
    "  const payload = event.data ? event.data.json() : {};",
    "  const notification = payload.notification ?? {};",
    "  const options = {",
    "    body: notification.body ?? payload.body ?? '',",
    "    icon: notification.icon ?? payload.icon ?? '/icons/icon-192.png',",
    "    badge: notification.badge ?? payload.badge ?? '/icons/icon-192.png',",
    "    data: {",
    "      deliveryId: payload.deliveryId ?? null,",
    "      ackUrl: payload.ackUrl ?? null,",
    "      clickUrl: payload.clickUrl ?? null,",
    "      url: notification.url ?? payload.url ?? '/',",
    "    },",
    "  };",
    "  event.waitUntil(self.registration.showNotification(notification.title ?? payload.title ?? 'Notification', options));",
    "});",
    "self.addEventListener('notificationclick', (event) => {",
    "  event.notification.close();",
    "  const url = event.notification.data?.url ?? '/';",
    "  event.waitUntil(self.clients.openWindow(url));",
    "});",
    "void EPE_API_URL;",
  ].join("\n");
}
