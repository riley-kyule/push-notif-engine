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
- Exposes a reusable `[epe_subscribe_button]` shortcode for theme templates, so one theme can stay generic across multiple WordPress installations while the plugin resolves the correct site settings locally
- Reads branding and opt-in prompt settings from the EPE site record so app name, icon, theme color, and custom prompt copy are managed centrally in EPE
- Renders the custom EPE opt-in prompt before falling back to the browser permission dialog
- Shows a small, low-opacity subscriber bell (an inline SVG icon, not an emoji) at the bottom-left once push is enabled, with recent notifications and an unsubscribe action — its position-avoidance logic only reacts to elements actually flush against the bottom edge, so it doesn't get pushed off-screen by an unrelated tall fixed/sticky element elsewhere on the page
- Uses the site-level recent-notification limit configured in EPE for the tray
- Works in multisite by using normal WordPress option storage per site

## Installation

1. Copy this folder into `wp-content/plugins/exotic-push-engine`.
2. Activate the plugin in WordPress admin.
3. Open `Settings > Exotic Push Engine`.
4. Configure the API URL and site key. Branding is pulled from the EPE site settings automatically.
5. Place `[epe_subscribe_button]` in the theme wherever you want the subscribe CTA to appear. The plugin hides the button for already-subscribed users and wires the click action to the currently configured site key and API URL.

## CSP guidance

Add the following to your site CSP if required:

- `script-src` must allow the EPE SDK origin
- `connect-src` must allow the EPE API origin
- `img-src` must allow the icon URL host if the icon is remote
- `worker-src` must allow the site origin because the service worker is served from `/push-sw.js`
- The shortcode itself does not need a per-site variant; the same `[epe_subscribe_button]` string works everywhere because the plugin reads the site key and API URL from its own settings.

## Notes

- This plugin is browser push only.
- Native APNs and FCM are not part of the current scope.
- The plugin uses rewrite rules for asset endpoints and flushes them on activation/deactivation.
