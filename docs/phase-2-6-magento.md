# Magento 2 Integration Guide

## Goal

Expose the EPE browser push bootstrap from a Magento 2 storefront without depending on any external push platform.

## What to Deploy

* EPE SDK bootstrap snippet in the storefront head
* `push-sw.js` at the storefront root
* `manifest.json` at the storefront root
* CSP allowlist entries for the API origin and asset origin
* Magento module scaffold under `integrations/magento/Exotic/PushEngine/`

## Recommended Layout

* Create a small Magento module, for example `Exotic_PushEngine`.
* Add a layout XML file that injects the SDK bootstrap into the storefront head.
* Expose `API URL`, `Site Key`, `App Name`, `Icon URL`, and `Theme Color` in Magento admin so branding stays managed from EPE.
* Publish `push-sw.js` and `manifest.json` into the Magento webroot during deployment.

## SDK Bootstrap

Use a head injection block that sets the site-specific config before the SDK loads:

```html
<script>
  window.ExoticPushEngineConfig = {
    apiUrl: "https://api.example.com/api",
    siteKey: "site-uuid",
    serviceWorkerUrl: "/push-sw.js",
    manifestUrl: "/manifest.json",
    iconUrl: "/icons/icon-192.png",
    appName: "Exotic Magazine"
  };
</script>
<script defer src="/assets/epe-sdk.js"></script>
```

## Service Worker

* Serve the worker from the storefront origin at `/push-sw.js`.
* Set `Service-Worker-Allowed: /`.
* Keep the worker static and cacheable.

## Manifest

* Serve `manifest.json` from the storefront origin.
* Ensure the manifest is linked from the storefront `<head>`.
* Set the `start_url` and `scope` to the storefront origin.

## CSP

Allow at minimum:

* `script-src` for the SDK origin
* `connect-src` for the EPE API origin
* `worker-src` for the storefront origin
* `img-src` for any remote icon host

## Deployment Notes

* Keep the module deployable through cPanel or rsync-based release flows.
* Do not introduce Docker assumptions into the deployment path.
* The module scaffold is intended as a release starter, not a replacement for the site-specific assets generated in the EPE dashboard.
