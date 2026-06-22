<?php

declare(strict_types=1);

namespace Exotic\PushEngine\Block;

use Magento\Framework\View\Element\Template\Context;
use Magento\Framework\View\Element\Template;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Store\Model\ScopeInterface;

final class Config extends Template
{
    public function __construct(
        Context $context,
        private readonly ScopeConfigInterface $scopeConfig,
        array $data = []
    ) {
        parent::__construct($context, $data);
    }

    public function getApiUrl(): string
    {
        return (string) $this->scopeConfig->getValue('epe_push_engine/general/api_url', ScopeInterface::SCOPE_STORE);
    }

    public function getSiteKey(): string
    {
        return (string) $this->scopeConfig->getValue('epe_push_engine/general/site_key', ScopeInterface::SCOPE_STORE);
    }

    public function getAppName(): string
    {
        return (string) ($this->scopeConfig->getValue('epe_push_engine/general/app_name', ScopeInterface::SCOPE_STORE) ?: $this->getData('app_name') ?: '');
    }

    public function getIconUrl(): string
    {
        return (string) $this->scopeConfig->getValue('epe_push_engine/general/icon_url', ScopeInterface::SCOPE_STORE);
    }

    public function getThemeColor(): string
    {
        return (string) ($this->scopeConfig->getValue('epe_push_engine/general/theme_color', ScopeInterface::SCOPE_STORE) ?: '#1c1917');
    }
}
