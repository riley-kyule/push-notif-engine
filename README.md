# Exotic Push Engine (EPE)

Self-hosted web push notification platform for Exotic Online Advertising. Built to replace WebPushr across 110+ Exotic-owned websites — own the subscriber data, eliminate per-subscriber subscription costs, and centralize campaign management.

Not a SaaS product. Not multi-tenant. Built for Exotic's own sites only.

## Contents

- [Architecture](#architecture)
- [Local development setup](#local-development-setup)
- [Authentication & roles](#authentication--roles)
- [Sites](#sites)
- [Subscribers](#subscribers)
- [Browser push delivery](#browser-push-delivery)
- [Campaigns](#campaigns)
- [Segments](#segments)
- [Workflow automation](#workflow-automation)
- [Analytics](#analytics)
- [Dashboard](#dashboard)
- [WordPress plugin](#wordpress-plugin)
- [Other platform integrations](#other-platform-integrations)
- [Production deployment](#production-deployment)
- [Testing](#testing)
- [Known gaps](#known-gaps)

## Architecture

Three services, one Postgres database, one Redis instance:

```
apps/dashboard    Next.js 15 dashboard (port 3000) — admin UI
services/api      NestJS API (port 3001) — REST API, auth, scheduling
services/worker    BullMQ worker (no HTTP port) — actually sends pushes
packages/*        Shared TypeScript types/utilities used by the above
```

- **API and dashboard never send push notifications directly.** Every send goes through a BullMQ queue (`browser-push-dispatch`) so delivery is retried, rate-limited, and survives API restarts.
- **The worker is the only process with web-push credentials in memory at send time.** It pulls jobs off the queue, fetches the site's VAPID keys, and calls the `web-push` library directly.
- **The dashboard is a thin client.** Its own `/api/dashboard/*` routes are a BFF (backend-for-frontend) layer that forwards requests to the real NestJS API with the user's JWT attached from an HTTP-only cookie. It does not talk to Postgres directly.
- **One VAPID key pair per site.** Generated server-side, never reused across sites.
- **Service workers are served from the site's own origin** (via the WordPress plugin, or a static file for other platforms) — the browser Push API requires this; EPE cannot serve a cross-origin service worker.

Deployment target is a single cPanel VPS with PM2 managing the three Node processes — no Docker.

## Local development setup

Requirements: Node 20+, PostgreSQL, Redis.

```bash
npm install                      # installs all workspaces from the root

createdb exotic_push_engine
for f in infrastructure/database/migrations/*.sql; do
  psql -d exotic_push_engine -f "$f"
done
```

Seed a dev admin user (no seed script exists yet — insert directly):

```sql
INSERT INTO users (role_id, email, name, password_hash, is_active)
SELECT id, 'admin@example.com', 'Dev Admin', '<argon2-hash>', true
FROM roles WHERE slug = 'super-admin';
```

Generate the argon2 hash with `node -e "require('argon2').hash('yourpassword').then(console.log)"`.

Each service needs its own `.env` (see `.env.example` in each of `services/api`, `services/worker`, `apps/dashboard`). None of the three load `.env` automatically at runtime in dev — `node dist/main.js` does not read `.env` files. Either `export` the variables in your shell before starting, or run via a process manager (PM2 in production) that injects them.

```bash
# services/api
DATABASE_URL=postgresql://user@127.0.0.1:5432/exotic_push_engine
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
PORT=3001
CORS_ORIGINS=http://127.0.0.1:3000

# services/worker
DATABASE_URL=...
REDIS_URL=...
BROWSER_PUSH_ACK_BASE_URL=http://127.0.0.1:3001/api   # used to build delivery/click ack URLs sent to browsers

# apps/dashboard
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
DASHBOARD_API_BASE_URL=http://127.0.0.1:3001/api
```

Run each service from its own directory:

```bash
cd services/api && npm run build && node dist/main.js
cd services/worker && npm run build && node dist/src/main.js
cd apps/dashboard && npm run dev          # serves on :3000
```

Or `npm run dev --workspaces` from the root to start all of them via their `dev` scripts (uses `nest start --watch`, `tsx watch`, and `next dev`).

### A dependency-hoisting gotcha

If you ever add a new `@nestjs/*` package to `services/api` and the API starts crashing on boot with `"No driver (HTTP) has been selected"`, it means npm nested the new package inside `services/api/node_modules` while `@nestjs/core` stayed hoisted at the repo root. NestJS's adapter loader does a bare `require()` from inside `@nestjs/core`'s own directory, which only resolves siblings at the same `node_modules` level — never into a nested workspace folder. Fix: add the offending package as an explicit dependency in the **root** `package.json` (see how `@nestjs/platform-express` is pinned there) so npm hoists a single shared copy, then `npm install` and commit the updated lockfile.

## Authentication & roles

JWT-based, with refresh token rotation.

- `POST /api/auth/login` → `{ accessToken (15min), refreshToken (30 days) }`. Refresh tokens are stored hashed (SHA-256) in `refresh_tokens`, rotated on every refresh.
- `POST /api/auth/refresh` → issues a new pair, revokes the old refresh token.
- Roles, most to least privileged: `super-admin > admin > editor > analyst`. Enforced via `@Roles(...)` + `RolesGuard` on each controller/route.
- All auth events (`auth.login.success`, `auth.login.failure`, `auth.token.refreshed`) are written to `audit_logs`.
- Passwords hashed with Argon2.
- A custom Redis-backed rate limiter (`services/api/src/rate-limit/`) guards every route — default 120 req/min per IP, overridden per-route with `@RateLimit({ limit, ttl })` (login: 10/min, refresh: 30/min).

The dashboard stores the access/refresh tokens in HTTP-only cookies (`epe_access_token`, `epe_refresh_token`) set by `/api/dashboard/auth/login`. `middleware.ts` redirects any request without `epe_access_token` to `/login`.

## Sites

A "site" is one Exotic-owned website. Each site has its own VAPID key pair — generated once, never shared.

- `POST /api/sites` — create. `platform` is one of `WordPress | Magento | Node.js | Laravel | Other`.
- `POST /api/sites/:id/generate-vapid` — generates a new VAPID key pair via the `web-push` library and stores it on the site. Required before that site can register subscribers or receive pushes.
- `POST /api/sites/:id/rest-api-credentials` — generates the site-scoped REST API key id and auth token for CRM integrations.
- `GET/PATCH /api/sites/:id`, `GET /api/sites`.
- No delete endpoint — sites aren't deletable through the API (campaigns and subscribers reference them by foreign key).

### REST API credentials

Each site can issue one REST API credential pair for CRM-driven actions and scheduling:

- `X-EPE-Site-Key: <rest_api_key_id>`
- `Authorization: Bearer <rest_api_auth_token>`

The dashboard exposes this under `Site Settings -> Integrations -> REST API`. The API also exposes `GET /api/sites/:id/rest-api/identity` as a protected verification endpoint for CRM systems that need to confirm the credentials before using downstream site-scoped actions.

Dashboard: `/sites` (list, with an "Add Site" button), `/sites/new`, `/sites/:id` (detail — VAPID keys, SDK snippet, downloadable service worker + manifest), `/sites/:id/edit`, `/platform-health` (platform score ring plus database, queue broker, storage, queue depth, worker heartbeat, and delivery drilldowns).

## Subscribers

A subscriber is one browser's push subscription for one site.

- `POST /api/subscribers/register` — **public, no auth.** Called directly by the browser SDK after the user grants notification permission. Body: `siteId, subscriptionEndpoint, p256dhKey, authKey, browser, deviceType, language`. `country` is optional — there's no geo-IP enrichment yet, so it defaults to `"Unknown"`.
- `GET /api/subscribers`, `GET /api/subscribers/:id`, `PATCH /api/subscribers/:id/status` — all require auth.
- Status values: `active | inactive | unsubscribed | expired`. A subscriber is auto-marked `expired` if a push to it returns HTTP 404/410 (the browser unsubscribed or the push service rejects it permanently).

## Browser push delivery

This is the actual send pipeline. Nothing here is synchronous from the caller's perspective — every dispatch just enqueues a job and returns immediately.

1. Something calls `BrowserPushService.dispatch({ siteId, title, body, url, icon, image, campaignId?, segmentId? })` (campaigns do this on send; there's also a raw `POST /api/browser-push/dispatch` for manual one-off pushes).
2. A job lands on the `browser-push-dispatch` BullMQ queue.
3. The **worker** picks it up:
   - Loads the site's VAPID credentials.
   - If `segmentId` is set, loads that segment's rule definition and filters subscribers by it (see [Segments](#segments)). Otherwise sends to every `active` subscriber on the site.
   - For each subscriber: inserts a `pending` row in `push_delivery_events`, attempts the send via `web-push` (retries up to 3x with exponential backoff on 429/5xx), then updates that row to `sent` or `failed`/`expired`.
   - If the job had a `campaignId`, marks that campaign `sent` once the batch finishes (or `failed` if the site has no usable VAPID credentials at all).

### Delivery confirmation and click tracking

Every push payload sent to the browser carries `deliveryId`, `ackUrl`, and `clickUrl` — all scoped to that specific `push_delivery_events` row:

- The service worker's `push` handler fires-and-forgets a `POST` to `ackUrl` (`/api/browser-push/deliveries/:id/delivered`) the moment it shows the notification. This flips the row to `delivered` — **not** the worker itself. (The worker only ever sets `sent`; only a real browser ack sets `delivered`. This is intentional — don't "fix" the worker to mark things delivered immediately, that defeats the whole point of having real delivery confirmation.)
- The service worker's `notificationclick` handler fires a `POST` to `clickUrl` (`/api/browser-push/deliveries/:id/clicked`) before navigating. This sets `clicked_at` and, if the row hadn't already been acked as delivered, upgrades it to `delivered` too (a click proves it arrived).
- Both endpoints are public (no auth — the browser has no session) and idempotent (clicking/acking twice doesn't double-count).

Two service worker implementations carry this logic and must be kept in sync if you change it:
- `apps/dashboard/public/browser-push-sw.js` — used by the dashboard's own demo/test flow.
- The inline SW served by `integrations/wordpress/epe-push/epe-push.php` at `/push-sw.js` on every WordPress site running the plugin. **This is the one that matters in production** — it's what actually runs on the 110+ WP sites.

`push_delivery_events.status` lifecycle: `pending → sent → delivered` (or `failed`/`expired` instead of `delivered`). `clicked_at` is a separate timestamp, independent of status.

## Campaigns

Full CRUD plus a dispatch pipeline.

- `POST/GET/PATCH/DELETE /api/campaigns(/:id)`
- `POST /api/campaigns/:id/clone` — duplicates a campaign as a new `draft`.
- `POST /api/campaigns/:id/preview` — returns the rendered title/body/buttons for UI preview, no side effects.
- `POST /api/campaigns/:id/schedule` — sets `status: scheduled`, `scheduledAt`, and optional recurrence (`recurrenceType: daily|weekly|monthly`, `recurrenceInterval`, `recurrenceUntilAt`).
- `POST /api/campaigns/:id/send` — dispatches immediately. Rejects with 409 if the campaign is already `sending` or `sent`.
- `POST /api/campaign-media` — uploads a campaign image or icon and returns a temporary asset URL plus asset ID.
- `GET /api/campaign-media/:id/file` — streams the uploaded image back for previews and push payloads.
- `GET /api/health/storage` — checks that the campaign media bucket is reachable.
- `GET /api/health/platform` — returns the weighted platform health summary used by the dashboard Platform Health page, including queue depth, worker heartbeat freshness, and top/bottom delivery drilldowns.
  The dashboard home page surfaces this status as a top-bar badge so storage issues are visible without opening the API directly.

A campaign can optionally target a `segmentId` (see below) instead of every active subscriber on the site. The API validates the segment belongs to the same site as the campaign — passing a segment from a different site returns 400.

Campaign action buttons are stored as a JSON array of `{ label, url }`. The dashboard campaign builder lets editors toggle the buttons on or off and edit both button labels and destinations before saving.

Uploaded campaign media is stored in object storage via the API layer, not on the API host's local disk. The database tracks only metadata and object keys. Media is automatically purged three days after the associated campaign push has been marked delivered. If a campaign is cloned, its attached media is duplicated so the retention rule on the original campaign does not break the clone.

The API expects these environment variables for campaign media storage:

- `CAMPAIGN_MEDIA_STORAGE_BUCKET`
- `CAMPAIGN_MEDIA_STORAGE_REGION`
- `CAMPAIGN_MEDIA_STORAGE_ENDPOINT`
- `CAMPAIGN_MEDIA_STORAGE_ACCESS_KEY_ID`
- `CAMPAIGN_MEDIA_STORAGE_SECRET_ACCESS_KEY`
- `CAMPAIGN_MEDIA_STORAGE_FORCE_PATH_STYLE`

### The scheduler

`CampaignsSchedulerService` runs a cron job every minute (`@nestjs/schedule`, in-process with the API — fine for a single-instance deployment, would double-fire if you ever ran two API replicas without adding a lock). Each tick:

- Finds every campaign with `status = 'scheduled'` and `scheduledAt <= now`.
- **One-off campaigns** go through the normal send path (`scheduled → sending → sent`).
- **Recurring campaigns** dispatch the current occurrence directly (without flipping status) and advance `scheduledAt` to the next occurrence. Once `recurrenceUntilAt` is passed, the campaign is marked `sent` and stops recurring.
- A failure on one campaign is logged and does not block the rest of the batch.

Campaign statuses: `draft | scheduled | sending | sent | failed | expired`.

## Segments

Rule-based subscriber targeting, scoped per site.

- `POST/GET/PATCH/DELETE /api/segments(/:id)`
- `POST /api/segments/estimate` — live reach estimate for an unsaved rule set. `GET /api/segments/:id/estimate` — same, for a saved segment.

A segment definition is `{ matchMode: "all" | "any", rules: [...] }`. Each rule is `{ field, operator, value }`:

- **Fields:** `country | browser | deviceType | language | status | lastSeenAt`
- **Operators:** `is | isNot | in | notIn` (for most fields), `withinDays | olderThanDays` (for `lastSeenAt` only, value is a number of days)

`matchMode: "all"` ANDs the rules together; `"any"` ORs them. The same rule-to-SQL builder exists twice — once in `services/api/src/segments/postgres-segments.repository.ts` (for reach estimation) and once in `services/worker/src/segment.util.ts` (for actually filtering subscribers at send time). If you add a new field or operator, update both.

## Content taxonomies

Campaign content labels are managed centrally instead of being hard-coded in the builder.

- `GET/POST/PATCH/DELETE /api/campaign-taxonomies(/:id)` — manage the controlled taxonomy list.
- `GET /api/campaign-taxonomies` powers the dashboard campaign builder dropdown and the taxonomy management page.
- The dashboard includes `/campaign-taxonomies` for adding, editing, deactivating, and deleting taxonomy labels.
- Campaigns continue storing the taxonomy slug in `content_type`, so reporting stays stable even if a label is renamed.

## Workflow automation

Phase 6 now includes a workflow console in the dashboard, RSS feed management, manual workflow event recording, and subscriber tag automation.

- `POST /api/workflow/events` and `GET /api/workflow/events` record and inspect workflow events.
- `POST /api/workflow/rss-feeds`, `GET /api/workflow/rss-feeds`, `PATCH /api/workflow/rss-feeds/:id`, `DELETE /api/workflow/rss-feeds/:id`, and `POST /api/workflow/rss-feeds/:id/poll` manage RSS automation.
- The dashboard `/workflow` page exposes feed controls, execution visibility, and event logging.

## Analytics

All read from `push_delivery_events`, `subscribers`, and `campaigns` — no separate aggregation table, so numbers are always live.

- `GET /api/analytics/overview?days=30` — cross-site totals: subscriber counts, active/total campaigns, delivery/click counts, overall delivery rate and CTR. Powers the dashboard home page.
- `GET /api/analytics/campaigns/:campaignId` — per-campaign breakdown: `pending/sent/delivered/failed/expired/clicked`, `deliveryRate` (delivered ÷ total), `clickThroughRate` (clicked ÷ (sent + delivered)).
- `GET /api/analytics/sites/:siteId?days=30` — subscriber totals + the same delivery/click breakdown, scoped to one site, plus daily subscriber growth.
- `GET /api/analytics/sites/:siteId/subscriber-growth?days=30` — just the growth series.
- `GET /api/analytics/countries?days=30` — country performance grouped from subscriber country data and delivery events.
- `GET /api/analytics/sites-performance?days=30` — cross-site delivery comparison with subscriber counts.
- `GET /api/analytics/time-performance?days=30` — hour-by-hour delivery and click volume in UTC.
- `GET /api/analytics/content-performance?days=30` — campaign performance grouped by controlled content taxonomy.
- `GET /api/analytics/export?report=content-performance&days=30` — CSV export for the current analytics views.
- The dashboard now has a dedicated `/analytics` reporting page with date-range controls, site scope selection, campaign performance panels, country/site/time reporting, controlled taxonomy reporting, and CSV export links.

**Click-through rate is computed against successfully handed-off pushes (`sent + delivered`), not against total attempts.** A push that failed or expired was never shown to anyone, so it shouldn't dilute the CTR denominator.

This is still a staged analytics layer — country, site, time-of-day, and controlled content-taxonomy reporting are live, while richer export formats remain next. See [Known gaps](#known-gaps).

## Dashboard

Next.js 15 App Router. Pages: `/` (overview), `/analytics`, `/sites`, `/sites/new`, `/sites/:id`, `/sites/:id/edit`, `/campaigns`, `/campaigns/new`, `/campaigns/:id`, `/subscribers`, `/subscribers/:id`, `/workflow`, `/login`.

- **Auth:** `middleware.ts` gates every route except `/login` and `/api/dashboard/auth/*` on the presence of the `epe_access_token` cookie.
- **Data fetching:** server components call the real NestJS API directly via `lib/server-api.ts`'s `apiFetch`/`apiJson`, which attach the Bearer token from the cookie automatically.
- **Client-side mutations** (forms, action buttons) go through `/api/dashboard/*` route handlers, which proxy to the NestJS API with the same cookie-based auth. None of these routes touch Postgres directly — they're a thin pass-through layer.
- **Fallback data:** several `_data/*.ts` files keep small hardcoded fallback objects (e.g. `fallbackSiteChoices`) used only if the API call fails or returns nothing — this is what lets the dashboard render something reasonable in a broken-API scenario, not a feature to rely on.

## WordPress plugin

`integrations/wordpress/epe-push/` — the production integration path for the ~110 WordPress sites.

- Serves the service worker at `/push-sw.js` and a web app manifest at `/manifest.json` (both via rewrite rules + `template_redirect`, not real files — see `serve_service_worker()`/`serve_manifest()` in `epe-push.php`).
- Injects the SDK (`assets/epe-sdk.js`) on every page via `wp_enqueue_scripts`.
- Admin settings page (`Settings → EPE Push`): API URL and Site Key only. Branding and opt-in prompt settings live in the EPE site settings and are fetched automatically.
- The SDK renders the custom EPE opt-in prompt, so sites do not rely on the native browser permission prompt as the primary user-facing experience.
- Once a browser is subscribed, the SDK shows a bottom-left bell launcher with recent notifications and an unsubscribe action. The tray count is controlled per site in EPE.
- The SDK handles the full subscribe flow: register the service worker → request notification permission → `PushManager.subscribe()` with the site's VAPID key → POST the resulting subscription to `/api/subscribers/register`.
- Site Settings → Integrations → REST API provides per-site API key and auth token credentials for CRM-managed push and scheduling use cases. The auth token is shown only once when generated.

To onboard a new WordPress site: create the site in EPE, set the branding and VAPID details in the site record, install the plugin, then paste the API URL + Site Key into the plugin settings.

## Other platform integrations

`docs/phase-2-6-*.md` contain integration guides for Magento, Node.js, and Laravel — these are documentation only, no actual plugin/package code has been written for them. WordPress is the only platform with a working, installable integration today.

Phase 7 is next and will expand the analytics surface with time, country, content, site, and export reporting.

## Production deployment

Full step-by-step runbook: [`infrastructure/deployment/cpanel.md`](infrastructure/deployment/cpanel.md). Summary of what exists:

- **`ecosystem.config.js`** (repo root) — PM2 process definitions for all three services. Each app loads its own `.env` by parsing it directly in the config file (PM2's built-in `env_file` option was tested and found to silently not apply the variables on the PM2 version used here — don't reintroduce it without re-verifying).
- **`services/api/scripts/migrate.mjs`** (run via `npm run migrate` from `services/api`) — idempotent migration runner. Tracks applied files in a `schema_migrations` table, so it's safe to run on every deploy, including the first one.
- **`infrastructure/nginx/epe.conf`** — reverse proxy config. Two things in here are easy to get wrong and were both bugs in an earlier version of this file: the API has a global `/api` route prefix that `proxy_pass` must preserve rather than strip, and the dashboard's own `/api/dashboard/*` BFF routes must be matched and routed to the dashboard (port 3000) *before* the generic `/api/*` block sends everything else to the real API (port 3001). Both are now correct and were verified against a real local nginx instance, not just read through.

All three of the above were actually run end-to-end locally (PM2 managing all three services, nginx proxying real requests through to them, a full login → create campaign → send → worker-processes-the-job round trip) before being considered done — not just written and assumed correct.

## Testing

```bash
npm run test --workspaces       # all three services + shared packages
npm run typecheck --workspaces
```

Each service uses Node's built-in test runner (`node --import tsx --test`), not Jest. Tests live alongside the code as `*.spec.ts` (API) or under `test/` (worker, dashboard).

## Known gaps

- **No geo-IP enrichment** — subscriber `country` is whatever the browser SDK sends (nothing, currently), defaults to `"Unknown"`.
- **Analytics is still expanding** — country, site, time-of-day, and controlled content taxonomy reporting exist, but Excel/PDF exports still need to be built.
- **Native mobile push (Phase 4) exists in code** (APNs/FCM credential storage, device registration, dispatch, click tracking endpoints) but is explicitly gated on Exotic having actual mobile apps to integrate with — nothing currently calls it.
- **Magento, Node.js, and Laravel integrations are docs-only.**
- **The site editor's "Subscribers" field is a leftover manual number input** that doesn't map to anything real (subscriber count is derived from actual registrations) — the API silently ignores it, but the UI still shows it.
- **No site deletion** — by design, not an oversight, since campaigns/subscribers reference sites by foreign key — but worth knowing if you go looking for a delete button that isn't there.
- **No automated PM2 boot-persistence test** — `pm2 save` + `pm2 startup` are documented in the runbook but haven't been tested through an actual server reboot, since that requires the real VPS.
