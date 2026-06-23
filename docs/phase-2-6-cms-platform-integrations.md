# Phase 2.6: CMS and Platform Integrations

## Goal

Provide site-specific integration artifacts for non-WordPress Exotic properties while keeping the deployment model cPanel/VPS friendly.

## Scope

* Dashboard site actions for:
  * Copy SDK Snippet
  * Download Service Worker
  * Download `manifest.json`
* Magento 2 integration guide
* Node.js integration guide
* Laravel integration guide

## Guides

* [Magento 2](phase-2-6-magento.md)
* [Node.js](phase-2-6-nodejs.md)
* [Laravel](phase-2-6-laravel.md)

## Starter Assets

* [`integrations/node/README.md`](../integrations/node/README.md)
* [`integrations/laravel/README.md`](../integrations/laravel/README.md)

## Dashboard Behavior

* Each site detail page exposes integration downloads derived from that site's metadata.
* The generated assets are site-specific and can be used as deployment starters for platform teams.
* WordPress, Magento, Node.js, and Laravel all now auto-serve `push-sw.js`, `manifest.json`, and the SDK from the site's own origin with no manual file publishing — install and go on every supported platform.
* Magento has a production scaffold under `integrations/magento/Exotic/PushEngine/` for teams that deploy through Magento release pipelines.
* Node.js and Laravel have explicit starter packages under `integrations/` — see their READMEs for the one-liner install (an Express mount call, or a Composer package whose service provider registers the same three routes).

## Notes

* Browser push and native mobile push (APNs/FCM) are both fully built delivery paths — see the main [README's Mobile push section](../README.md#mobile-push) and [docs/mobile-push-integration.md](./mobile-push-integration.md) for the app-facing integration guide.
* Phase 2.6 documentation is intentionally separate from the WordPress plugin documentation to keep integration patterns explicit by platform.
