# Exotic Push Engine Laravel Starter

Install-and-go integration — no files to publish into `public/`.

## Install

```bash
composer require epe/laravel-starter
php artisan vendor:publish --tag=epe-push-assets
```

Publishing only copies the **config file** (`config/epe-push.php`) and a sample
Blade partial you can customize — it does not copy `push-sw.js`, `manifest.json`,
or the SDK. Those three are registered as routes automatically when the package
boots, generated from your config on every request.

Set the two required values in `.env`:

```
EPE_API_URL=https://push.example.com/api
EPE_SITE_KEY=your-site-uuid
```

## Add the bootstrap to your layout

```blade
@include('epe-push::bootstrap')
```

Drop that into your main layout's `<head>` (e.g.
`resources/views/layouts/app.blade.php`). It renders the
`window.ExoticPushEngineConfig` object plus the SDK `<script>` tag.

## What the package serves automatically

- `GET /push-sw.js` — generated from `EpePush::serviceWorkerScript()`, same logic the Node and WordPress integrations use.
- `GET /manifest.json` — generated from your config (`app_name`, `theme_color`, `icon_url`) via `EpePush::manifestJson()`.
- `GET /assets/epe-sdk.js` — served straight from the package's vendored copy of the SDK (same file the WordPress plugin bundles).

Override the manifest/service-worker URLs via `EPE_MANIFEST_URL` /
`EPE_PUSH_SW_URL` in `.env` if `/manifest.json` or `/push-sw.js` collide with
something else in your app.

## Config reference (`config/epe-push.php`)

| Key | Env var | Default |
| --- | --- | --- |
| `api_url` | `EPE_API_URL` | — |
| `site_key` | `EPE_SITE_KEY` | — |
| `service_worker_url` | `EPE_PUSH_SW_URL` | `/push-sw.js` |
| `manifest_url` | `EPE_MANIFEST_URL` | `/manifest.json` |
| `app_name` | `EPE_APP_NAME` | `config('app.name')` |
| `icon_url` | `EPE_ICON_URL` | `/icons/icon-192.png` |
| `theme_color` | `EPE_THEME_COLOR` | `#111111` |

Branding, opt-in prompt copy, and colors beyond `theme_color` live in EPE site
settings and are fetched automatically by the SDK — they're not configured here.
