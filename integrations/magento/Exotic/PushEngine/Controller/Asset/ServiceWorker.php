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

    private static function script(): string
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
