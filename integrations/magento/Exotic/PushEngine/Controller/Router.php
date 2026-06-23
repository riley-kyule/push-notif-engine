<?php

declare(strict_types=1);

namespace Exotic\PushEngine\Controller;

use Magento\Framework\App\ActionFactory;
use Magento\Framework\App\ActionInterface;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\App\RouterInterface;

// Lets the storefront serve /push-sw.js, /manifest.json, and /assets/epe-sdk.js
// at the literal root paths browsers expect for a service worker and web app
// manifest — Magento's normal dispatch only matches /<frontName>/... URLs, so
// without this router those three assets would have to be hand-placed under
// pub/ on every release, which is the manual step this module exists to avoid.
final class Router implements RouterInterface
{
    private const PATH_MAP = [
        '/push-sw.js' => \Exotic\PushEngine\Controller\Asset\ServiceWorker::class,
        '/manifest.json' => \Exotic\PushEngine\Controller\Asset\Manifest::class,
        '/assets/epe-sdk.js' => \Exotic\PushEngine\Controller\Asset\Sdk::class,
    ];

    public function __construct(private readonly ActionFactory $actionFactory)
    {
    }

    public function match(RequestInterface $request): ?ActionInterface
    {
        $path = rtrim((string) $request->getPathInfo(), '/');
        $actionClass = self::PATH_MAP[$path] ?? null;

        if ($actionClass === null) {
            return null;
        }

        return $this->actionFactory->create($actionClass);
    }
}
