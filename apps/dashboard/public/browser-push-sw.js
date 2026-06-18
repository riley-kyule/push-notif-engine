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

self.addEventListener("push", (event) => {
  const payload = resolvePayload(event.data);
  event.waitUntil(Promise.all([showPushNotification(payload), acknowledgeDelivery(payload)]));
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
  event.waitUntil(
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
  );
});
