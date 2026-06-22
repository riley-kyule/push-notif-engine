# Exotic Push Engine Node.js Starter

This is the production starter path for custom Node.js sites that need EPE without a CMS plugin.

## What you deploy

- `push-sw.js` at the site origin root
- `manifest.json` at the site origin root
- the EPE SDK bootstrap in the shared layout or document head
- a small registration flow that calls the EPE API with the site key

## Runtime contract

- The service worker must be served from the same origin as the site.
- The manifest must be reachable at `/manifest.json`.
- The SDK bootstrap should expose a single configuration object on `window`.
- Site-specific branding, prompt copy, and colors should live in EPE site settings, not in the application code.

## Example layout snippet

```html
<script>
  window.ExoticPushEngineConfig = {
    apiUrl: "https://api.example.com/api",
    siteKey: "site-uuid",
    serviceWorkerUrl: "/push-sw.js",
    manifestUrl: "/manifest.json",
    iconUrl: "/icons/icon-192.png",
    appName: "Exotic News",
    themeColor: "#111111",
  };
</script>
<script defer src="/assets/epe-sdk.js"></script>
```

## Suggested file layout

- `public/push-sw.js`
- `public/manifest.json`
- `public/assets/epe-sdk.js`
- `src/integrations/epe.ts`

## Minimal integration flow

1. Render the bootstrap snippet on every page.
2. Serve the worker and manifest from the origin root.
3. Use the site key to resolve the browser push configuration from EPE.
4. Let the SDK handle registration and notification opt-in.

## Notes

- Keep this starter framework-agnostic.
- Avoid cross-origin worker registrations.
- Keep platform-specific branding in EPE site settings.
