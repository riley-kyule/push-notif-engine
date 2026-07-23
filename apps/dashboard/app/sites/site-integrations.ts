import type { SiteSummary } from "./sites.utils";

function escapeForTemplate(value: string | null | undefined, fallback = ""): string {
  return (value ?? fallback).replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
}

export function buildSdkSnippet(site: SiteSummary): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://api.exoticpush.local/api";
  const appName = site.appName || site.name;
  const config = {
    apiUrl,
    siteKey: site.id,
    vapidPublicKey: site.vapidPublicKey,
    serviceWorkerUrl: `${new URL(site.url).origin}/push-sw.js`,
    manifestUrl: `${new URL(site.url).origin}/manifest.json`,
    iconUrl: site.iconUrl,
    appName,
    themeColor: site.themeColor || "#1c1917",
    optInPromptType: site.optInPromptType,
    optInPromptAnimation: site.optInPromptAnimation,
    optInPromptBackgroundColor: site.optInPromptBackgroundColor,
    optInPromptHeadline: site.optInPromptHeadline,
    optInPromptHeadlineTextColor: site.optInPromptHeadlineTextColor,
    optInPromptText: site.optInPromptText,
    optInPromptTextColor: site.optInPromptTextColor,
    optInPromptIconUrl: site.optInPromptIconUrl,
    optInPromptCancelButtonLabel: site.optInPromptCancelButtonLabel,
    optInPromptCancelButtonTextColor: site.optInPromptCancelButtonTextColor,
    optInPromptCancelButtonBackgroundColor: site.optInPromptCancelButtonBackgroundColor,
    optInPromptApproveButtonLabel: site.optInPromptApproveButtonLabel,
    optInPromptApproveButtonTextColor: site.optInPromptApproveButtonTextColor,
    optInPromptApproveButtonBackgroundColor: site.optInPromptApproveButtonBackgroundColor,
    optInPromptRepromptDelayDays: site.optInPromptRepromptDelayDays,
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

export function buildSubscriptionShortcode(): string {
  return "[epe_subscribe_button]";
}

export function buildRestApiSnippet(site: SiteSummary): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://api.exoticpush.local/api";
  return [
    `curl -X POST ${JSON.stringify(`${apiUrl}/sites/${site.id}/rest-api-credentials`)}`,
    "  -H 'Authorization: Bearer <dashboard-session-jwt>'",
    "  -H 'Content-Type: application/json'",
    "  -d '{}'",
  ].join("\n");
}

export function buildRestApiUsageSnippet(site: SiteSummary): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://api.exoticpush.local/api";
  const siteKey = site.restApiKeyId ?? "<rest-api-key-id>";
  return [
    `curl -X GET ${JSON.stringify(`${apiUrl}/sites/${site.id}/rest-api/identity`)}`,
    `  -H 'X-EPE-Site-Key: ${siteKey}'`,
    "  -H 'Authorization: Bearer <rest-api-auth-token>'",
  ].join("\n");
}

export function buildServiceWorkerAsset(site: SiteSummary): string {
  const appName = escapeForTemplate(site.appName, site.name);
  const vapidPublicKey = escapeForTemplate(site.vapidPublicKey ?? "");
  const iconUrl = JSON.stringify(site.iconUrl || "");
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
    icon: payload.icon || ${iconUrl} || undefined,
    image: payload.image || undefined,
    badge: payload.badge || ${iconUrl} || undefined,
    data: {
      url: payload.url || '/',
    },
    actions: Array.isArray(payload.buttons)
      ? payload.buttons.slice(0, 2).map((button) => ({ action: button.url, title: button.label }))
      : [],
  };

  return self.registration.showNotification(title, options);
}

async function postCallback(url) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'omit', cache: 'no-store' });
      if (response.ok) return;
    } catch (_) {}
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
  }
}

function acknowledgeDelivery(payload) {
  if (!payload.deliveryId || !payload.ackUrl) {
    return Promise.resolve();
  }

  return postCallback(payload.ackUrl);
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
  const appName = site.appName || site.name;
  const manifest = {
    name: appName,
    short_name: appName,
    start_url: `${origin}/`,
    scope: `${origin}/`,
    display: "standalone",
    theme_color: site.themeColor || "#1c1917",
    background_color: "#fafaf9",
    icons: [
      {
        src: site.iconUrl || `${origin}/icon.png`,
        sizes: "192x192",
        type: "image/png",
      },
    ],
  };

  return JSON.stringify(manifest, null, 2);
}
