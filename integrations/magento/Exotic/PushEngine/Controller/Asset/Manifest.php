<?php

declare(strict_types=1);

namespace Exotic\PushEngine\Controller\Asset;

use Magento\Framework\App\Action\HttpGetActionInterface;
use Magento\Framework\App\Action\Context;
use Magento\Framework\App\Action\Action;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\Controller\Result\Raw;
use Magento\Framework\Controller\ResultInterface;
use Magento\Store\Model\ScopeInterface;

// Built from admin config on every request — changing the app name, icon, or
// theme color in Stores -> Configuration takes effect immediately, with no
// static manifest.json in pub/ to fall out of sync.
final class Manifest extends Action implements HttpGetActionInterface
{
    public function __construct(
        Context $context,
        private readonly ScopeConfigInterface $scopeConfig
    ) {
        parent::__construct($context);
    }

    public function execute(): ResultInterface
    {
        $appName = (string) $this->scopeConfig->getValue('epe_push_engine/general/app_name', ScopeInterface::SCOPE_STORE);
        $iconUrl = (string) $this->scopeConfig->getValue('epe_push_engine/general/icon_url', ScopeInterface::SCOPE_STORE);
        $themeColor = (string) ($this->scopeConfig->getValue('epe_push_engine/general/theme_color', ScopeInterface::SCOPE_STORE) ?: '#1c1917');

        $manifest = [
            'name' => $appName,
            'short_name' => mb_substr($appName, 0, 12),
            'display' => 'standalone',
            'theme_color' => $themeColor,
            'background_color' => '#ffffff',
            'scope' => '/',
            'start_url' => '/',
            'icons' => [
                ['src' => $iconUrl ?: '/icons/icon-192.png', 'sizes' => '192x192', 'type' => 'image/png'],
            ],
        ];

        /** @var Raw $result */
        $result = $this->resultFactory->create(\Magento\Framework\Controller\ResultFactory::TYPE_RAW);
        $result->setHeader('Content-Type', 'application/manifest+json');
        $result->setContents((string) json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return $result;
    }
}
