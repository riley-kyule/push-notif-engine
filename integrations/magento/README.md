# Exotic Push Engine Magento 2 Module

This is the Magento integration scaffold for Exotic Push Engine.

## What it does

- Adds an admin config section under `Stores -> Configuration -> General -> EPE Push Engine`
- Injects the EPE SDK config into the storefront `<head>`
- Serves `/push-sw.js`, `/manifest.json`, and `/assets/epe-sdk.js` itself, generated from admin config on every request
- Keeps the service worker and manifest on the storefront origin

## Deployment model

Install-and-go: nothing to copy into `pub/`. A custom frontend router
(`Exotic\PushEngine\Controller\Router`, registered in `etc/frontend/di.xml`)
intercepts those three literal paths and serves them straight from PHP, the
same way the Node, Laravel, and WordPress integrations do. Editing the app
name, icon, or theme color in admin takes effect immediately — there's no
static file to fall out of sync or forget to re-publish on release.

## CSP guidance

Allow at minimum:

- `script-src` for the EPE SDK origin
- `connect-src` for the EPE API origin
- `worker-src 'self'`
- `img-src` for any remote icon host

## Installation

1. Copy the module into `app/code/Exotic/PushEngine`.
2. Run `bin/magento module:enable Exotic_PushEngine`.
3. Run `bin/magento setup:upgrade`.
4. Configure the API URL and Site Key in admin.

## Notes

- Browser push only.
- No Docker assumptions.
- No native app push.
- The vendored `epe-sdk.js` is the same file shipped by the WordPress plugin (the source of truth) and the Node/Laravel starters — re-copy it from there if it's updated upstream rather than editing this copy independently.
