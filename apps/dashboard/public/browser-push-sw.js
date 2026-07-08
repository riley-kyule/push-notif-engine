self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function resolvePayload(data) {
  if (!data) {
    return {};
  }

  if (data.type === "browser-push-demo" && data.notification) {
    return data.notification;
  }

  if (typeof data.json === "function") {
    try {
      return data.json();
    } catch {
      return {};
    }
  }

  return data.notification || data;
}

function showPushNotification(payload) {
  const title = payload.title || "Exotic Push Engine";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/logo-icon.svg",
    image: payload.image || undefined,
    data: {
      url: payload.url || "/",
      clickUrl: payload.clickUrl || null,
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
    method: "POST",
  }).catch(() => undefined);
}

function acknowledgeClick(clickUrl) {
  if (!clickUrl) {
    return Promise.resolve();
  }

  return fetch(clickUrl, {
    method: "POST",
  }).catch(() => undefined);
}

function notifyOpenPages() {
  // Let any open pages know a push landed so subscriber-facing UI (e.g. the
  // bell badge / recents tray in the site SDK) can refresh without a reload.
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((client) => client.postMessage({ type: "epe:push-received" }));
    })
    .catch(() => undefined);
}

self.addEventListener("push", (event) => {
  const payload = resolvePayload(event.data);
  event.waitUntil(Promise.all([showPushNotification(payload), acknowledgeDelivery(payload), notifyOpenPages()]));
});

self.addEventListener("message", (event) => {
  const payload = resolvePayload(event.data);
  if (!payload || (!payload.title && !payload.body && !payload.url)) {
    return;
  }

  event.waitUntil(showPushNotification(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data && event.notification.data.url ? event.notification.data.url : "/";
  const clickUrl = event.notification.data && event.notification.data.clickUrl ? event.notification.data.clickUrl : null;
  event.waitUntil(
    Promise.all([
      acknowledgeClick(clickUrl),
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client) {
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
    ]),
  );
});
