# Exotic Push Engine Laravel Starter

This is the production starter path for Laravel sites that need EPE without a CMS plugin.

## What you deploy

- `public/push-sw.js`
- `public/manifest.json`
- the EPE SDK bootstrap in a shared Blade layout
- a small registration flow that uses the site key and API URL

## Runtime contract

- The service worker must be served from the same origin as the Laravel app.
- The manifest must be reachable at `/manifest.json`.
- Site branding and opt-in prompt settings should live in EPE site settings.
- The app should only receive the API URL and site key from environment/config values.

## Example Blade snippet

```blade
<script>
  window.ExoticPushEngineConfig = @json([
    'apiUrl' => env('EPE_API_URL', 'https://api.example.com/api'),
    'siteKey' => env('EPE_SITE_KEY'),
    'serviceWorkerUrl' => '/push-sw.js',
    'manifestUrl' => '/manifest.json',
    'iconUrl' => '/icons/icon-192.png',
    'appName' => config('app.name'),
    'themeColor' => '#111111',
  ]);
</script>
<script defer src="/assets/epe-sdk.js"></script>
```

## Suggested file layout

- `public/push-sw.js`
- `public/manifest.json`
- `public/assets/epe-sdk.js`
- `resources/views/layouts/app.blade.php`
- `app/Services/EpePush.php`

## Minimal integration flow

1. Inject the SDK bootstrap in the main layout.
2. Publish the worker and manifest during deployment.
3. Resolve the site key from `.env` or a config file.
4. Let the SDK register the browser subscription against EPE.

## Notes

- Keep the starter deployment-friendly.
- Do not depend on Docker or container-only release steps.
- Keep the worker and manifest on the app origin.
