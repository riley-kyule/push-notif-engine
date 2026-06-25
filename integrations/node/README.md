# Exotic Push Engine Node.js Starter

Install-and-go integration for Express apps, plus framework-agnostic generator
functions for everything else.

## Express (recommended — no files to publish)

```ts
import express from "express";
import { mountEpePush } from "@epe/node-starter/express";
import { buildBootstrapSnippet } from "@epe/node-starter";

const config = {
  apiUrl: "https://push.example.com",
  siteKey: process.env.EPE_SITE_KEY!,
  appName: "Exotic News",
  iconUrl: "/icons/icon-192.png",
  themeColor: "#111111",
};

const app = express();
mountEpePush(app, config, express.static);
// Registers GET /push-sw.js and GET /manifest.json (generated live from config —
// change config, the response changes, nothing to republish) and serves the
// vendored EPE SDK at GET /assets/epe-sdk.js.

app.get("/", (_req, res) => {
  res.send(`<html><head>${buildBootstrapSnippet(config)}</head><body>...</body></html>`);
});
```

That's the whole integration: one `mountEpePush` call plus the bootstrap snippet
in your page template's `<head>`. No files to copy into `public/`, no manifest
to keep in sync by hand.

## Non-Express frameworks

`mountEpePush` is an Express convenience wrapper around three framework-agnostic
pieces exported from `@epe/node-starter`:

- `buildBootstrapSnippet(config)` — the `<script>` tag pair for your page template.
- `buildManifest(config)` — `manifest.json` contents; serve it yourself at `/manifest.json`.
- `buildServiceWorkerScript(config)` — `push-sw.js` contents; serve it yourself at `/push-sw.js`, same origin as the site.
- The vendored SDK lives at `assets/epe-sdk.js` in this package — serve it as a static file at `/assets/epe-sdk.js` (same file the WordPress plugin bundles; re-copy it here if it's updated upstream).

## Runtime contract

- The service worker must be served from the same origin as the site.
- Site branding, opt-in prompt copy, and colors live in EPE site settings — fetched automatically by the SDK, not configured here.
- `siteKey` and `apiUrl` are the only two values you need from EPE; generate a REST API key/token in the dashboard only if your app also needs native mobile push or CRM-style API access (see `docs/mobile-push-integration.md` in the main repo).
