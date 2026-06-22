# Exotic Push Engine WordPress Plugin

This is the WordPress integration scaffold for Exotic Push Engine.

## What it does

- Serves the service worker from the WordPress origin at `/push-sw.js`
- Serves the web app manifest at `/manifest.json`
- Injects a `<link rel="manifest">` tag into the frontend `<head>`
- Injects the EPE SDK on every frontend page
- Provides an admin settings page for:
  - API URL
  - Site key
- Reads branding and opt-in prompt settings from the EPE site record so app name, icon, theme color, and custom prompt copy are managed centrally in EPE
- Renders the custom EPE opt-in prompt before falling back to the browser permission dialog
- Shows a subscriber bell at the bottom-left once push is enabled, with recent notifications and an unsubscribe action
- Uses the site-level recent-notification limit configured in EPE for the tray
- Works in multisite by using normal WordPress option storage per site

## Installation

1. Copy this folder into `wp-content/plugins/exotic-push-engine`.
2. Activate the plugin in WordPress admin.
3. Open `Settings > Exotic Push Engine`.
4. Configure the API URL and site key. Branding is pulled from the EPE site settings automatically.

## CSP guidance

Add the following to your site CSP if required:

- `script-src` must allow the EPE SDK origin
- `connect-src` must allow the EPE API origin
- `img-src` must allow the icon URL host if the icon is remote
- `worker-src` must allow the site origin because the service worker is served from `/push-sw.js`

## Notes

- This plugin is browser push only.
- Native APNs and FCM are not part of the current scope.
- The plugin uses rewrite rules for asset endpoints and flushes them on activation/deactivation.
