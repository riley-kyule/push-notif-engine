# Exotic Push Engine Magento 2 Module

This is the Magento integration scaffold for Exotic Push Engine.

## What it does

- Adds an admin config section under `Stores -> Configuration -> General -> EPE Push Engine`
- Injects the EPE SDK config into the storefront `<head>`
- Assumes the service worker is deployed at `/push-sw.js`
- Assumes the manifest is deployed at `/manifest.json`
- Keeps the service worker and manifest on the storefront origin

## Deployment model

Magento should deploy these assets during release:

- `pub/push-sw.js`
- `pub/manifest.json`
- `pub/assets/epe-sdk.js`

The module itself only injects the config and script tag.

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
