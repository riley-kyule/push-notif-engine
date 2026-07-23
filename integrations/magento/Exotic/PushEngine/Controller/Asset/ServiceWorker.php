<?php

declare(strict_types=1);

namespace Exotic\PushEngine\Controller\Asset;

use Magento\Framework\App\Action\HttpGetActionInterface;
use Magento\Framework\App\Action\Context;
use Magento\Framework\App\Action\Action;
use Magento\Framework\Controller\Result\Raw;
use Magento\Framework\Controller\ResultInterface;

// Generated on every request, not published into pub/ — mirrors the Laravel
// and WordPress integrations' service worker verbatim, so there's nothing for
// a release to forget to copy.
final class ServiceWorker extends Action implements HttpGetActionInterface
{
    public function __construct(Context $context)
    {
        parent::__construct($context);
    }

    public function execute(): ResultInterface
    {
        /** @var Raw $result */
        $result = $this->resultFactory->create(\Magento\Framework\Controller\ResultFactory::TYPE_RAW);
        $result->setHeader('Content-Type', 'application/javascript');
        $result->setContents(self::script());

        return $result;
    }

    // Mirrors the WordPress plugin's service worker: flat payload shape,
    // delivery/click acknowledgement, image + action buttons, and a
    // postMessage so open pages can refresh the bell badge live.
    private static function script(): string
    {
        return <<<'JS'
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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

function acknowledgeClick(clickUrl) {
  if (!clickUrl) {
    return Promise.resolve();
  }

  return postCallback(clickUrl);
}

self.addEventListener('push', (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || 'Notification';
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
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
