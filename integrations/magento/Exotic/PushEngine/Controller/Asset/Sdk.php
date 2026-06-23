<?php

declare(strict_types=1);

namespace Exotic\PushEngine\Controller\Asset;

use Magento\Framework\App\Action\HttpGetActionInterface;
use Magento\Framework\App\Action\Context;
use Magento\Framework\App\Action\Action;
use Magento\Framework\Controller\Result\Raw;
use Magento\Framework\Controller\ResultInterface;
use Magento\Framework\Module\Dir\Reader as ModuleDirReader;

// Served straight from the module's vendored copy — identical to the file
// shipped with the Node, Laravel, and WordPress integrations.
final class Sdk extends Action implements HttpGetActionInterface
{
    public function __construct(
        Context $context,
        private readonly ModuleDirReader $moduleDirReader
    ) {
        parent::__construct($context);
    }

    public function execute(): ResultInterface
    {
        $path = $this->moduleDirReader->getModuleDir('view', 'Exotic_PushEngine') . '/frontend/web/js/epe-sdk.js';
        $contents = is_readable($path) ? file_get_contents($path) : false;

        /** @var Raw $result */
        $result = $this->resultFactory->create(\Magento\Framework\Controller\ResultFactory::TYPE_RAW);
        $result->setHeader('Content-Type', 'application/javascript');
        $result->setContents($contents === false ? '' : $contents);

        return $result;
    }
}
