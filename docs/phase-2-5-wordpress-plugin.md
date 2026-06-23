# Phase 2.5: WordPress Plugin

## Goal

Ship a first-class WordPress integration so Exotic sites can serve push assets from their own origin.

## Scope

* Service worker served from `/push-sw.js`
* Web app manifest served from `/manifest.json`
* `<link rel="manifest">` injected into every frontend page
* SDK injection on every frontend page
* Admin settings page for API URL and site key
* Branding and opt-in prompt values managed centrally in EPE site settings and fetched by the plugin
* Custom EPE prompt rendered before the native browser permission request
* Subscriber bell tray for recent notifications and unsubscribe handling
* Multisite-compatible option storage
* CSP guidance for WordPress admins

## Files

* `integrations/wordpress/epe-push/epe-push.php`
* `integrations/wordpress/epe-push/assets/epe-sdk.js`
* `integrations/wordpress/epe-push/README.md`

## Notes

* The plugin uses WordPress rewrite rules to serve the service worker and manifest from the site origin.
* The SDK is injected via `wp_enqueue_scripts`.
* Settings are stored with standard WordPress option APIs so the plugin remains cPanel/VPS friendly.
* Browser push only is in scope. Native APNs/FCM is not part of this phase.
