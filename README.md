# Exotic Push Engine (EPE)

Self-hosted web push notification platform for Exotic Online Advertising. Built to replace WebPushr across 110+ Exotic-owned websites — own the subscriber data, eliminate per-subscriber subscription costs, and centralize campaign management.

Not a SaaS product. Not multi-tenant. Built for Exotic's own sites only.

## Contents

- [Architecture](#architecture)
- [Local development setup](#local-development-setup)
- [Authentication & roles](#authentication--roles)
- [Backup](#backup)
- [Sites](#sites)
- [Subscribers](#subscribers)
- [Browser push delivery](#browser-push-delivery)
- [Mobile push](#mobile-push)
- [Campaigns](#campaigns)
- [Segments](#segments)
- [Content taxonomies](#content-taxonomies)
- [Workflow automation](#workflow-automation)
- [Analytics](#analytics)
- [Dashboard](#dashboard)
- [WordPress plugin](#wordpress-plugin)
- [Other platform integrations](#other-platform-integrations)
- [Production deployment](#production-deployment)
- [Infrastructure runbooks](#infrastructure-runbooks)
- [Testing](#testing)
- [Known gaps](#known-gaps)

## Architecture

Three services, one Postgres database, one Redis instance:

```
apps/dashboard    Next.js 15 dashboard (port 3000) — admin UI
services/api      NestJS API (port 3001) — REST API, auth, scheduling
services/worker   BullMQ worker (no HTTP port) — actually sends pushes
integrations/*    WordPress plugin, Magento module, Node.js/Laravel starter packages
```

(There used to be a `packages/*` workspace for shared types/utilities — removed, it had zero real imports across the three services.)

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
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=
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

JWT-based, with refresh token rotation and Google sign-in support.

- `POST /api/auth/login` → `{ accessToken (15min), refreshToken (30 days) }`. Refresh tokens are stored hashed (SHA-256) in `refresh_tokens`, rotated on every refresh.
- `POST /api/auth/google` → accepts a Google ID token, verifies it against Google's tokeninfo endpoint, links the Google subject to the existing Exotic user record, and issues the same JWT pair.
- `POST /api/auth/refresh` → issues a new pair, revokes the old refresh token.
- Roles, most to least privileged: `super-admin > admin > sub-admin > customer-service`. Legacy `editor`/`analyst` slugs (the original names for `sub-admin`/`customer-service`) are still accepted everywhere via `canonicalRoleSlug()` so existing user records and any external references don't break. Enforced via `@Roles(...)` + `RolesGuard` on each controller/route.
- Each role's permission set lives on `roles.permissions` (JSONB) — 14 possible slugs (`users:manage`, `roles:manage`, `automations:manage`, `sites:manage`, `sites:settings`, `analytics:view`, `subscribers:view`, `campaigns:manage`, `campaigns:assigned`, `campaign-taxonomies:manage`, `segments:manage`, `audit-logs:view`, `system-health:view`, `backups:manage`). Only `super-admin` can edit another role's permissions or rename a role (`PATCH /api/access-control/roles/:slug`); `admin` and above can manage users.
- Access control API: `GET /api/access-control/roles`, `GET /api/access-control/users`, `POST /api/access-control/users` (first/last name, email, role — no password field), `PATCH /api/access-control/users/:id/role`, `PATCH /api/access-control/roles/:slug` (name/permissions).
- New users get an auto-generated, collision-checked username (lowercased first name, numeric suffix or timestamp if taken) and a random 24-byte password hash — nobody, including the creating admin, ever sees a plaintext password. The dashboard's `/access-control` page makes this explicit ("the system generates the username and a password behind the scenes") since Google sign-in is the intended path for these accounts.
- All auth and access-control events (`auth.login.success/failure`, `auth.google.login.success/failure`, `auth.token.refreshed`, `access_control.user_created`, `access_control.user_role_updated`, `access_control.role_updated`) are written to `audit_logs`.
- Passwords hashed with Argon2.
- A custom Redis-backed rate limiter (`services/api/src/rate-limit/`) guards every route — default 120 req/min per IP, overridden per-route with `@RateLimit({ limit, ttl })` (login: 10/min, refresh: 30/min).

The dashboard stores the access/refresh tokens in HTTP-only cookies (`epe_access_token`, `epe_refresh_token`) set by `/api/dashboard/auth/login` and `/api/dashboard/auth/google`. `middleware.ts` redirects any request without `epe_access_token` to `/login`.

Google sign-in is the only supported SSO provider in the dashboard login UI. It uses the Google Identity Services button and only links to pre-provisioned Exotic user accounts whose email is already present in the system.

The dashboard includes `/audit-logs` (super-admin/admin only, rate-limited 60/min) for reviewing every audited action above plus site, campaign, segment, taxonomy, automation, and backup events — actor identity, target, and a metadata JSON blob per row.

## Backup

Full-system backups to a connected cloud provider, managed at `/platform/backup-config`.

- Providers: **Dropbox** and **Google Drive**, connected via OAuth (`GET /api/backup/:provider/authorize-url` → `POST /api/backup/:provider/exchange`). Refresh tokens are encrypted at rest (`BACKUP_TOKEN_ENCRYPTION_KEY`).
- A backup archive is a single `tar.gz` containing a real `pg_dump --format=custom` of the whole database plus every campaign media file — everything needed to restore or migrate the system, deliberately excluding `.env`/secrets.
- Scheduling is a `@Cron(EVERY_HOUR)` check (`BackupSchedulerService`) against each connection's `auto_backup_enabled`/`frequency` (daily/weekly/monthly)/`next_backup_due_at` — or trigger one immediately with `POST /api/backup/:provider/run` (runs in the background, returns right away).
- **Restore is manual, by design** — there's no one-click restore endpoint. The dashboard's restore toolkit card pre-fills the exact `pg_restore` command for the latest successful run with a copy button; campaign media is restored by extracting the archive's `media/` directory.
- `GET /api/backup` (provider connection status) and `GET /api/backup/runs` (history: status, trigger, file name/size, error message) back the dashboard's summary cards and run history table.

### Getting Dropbox app credentials

There's no way to get a Dropbox API key/secret without creating an "app" in their developer console — but it's a 3-minute form, not a real registration process, and it works with your own account immediately (no app review needed).

1. Go to <https://www.dropbox.com/developers/apps> and click **Create app**.
2. Choose **Scoped access**, then **App folder** (simplest — gives the app its own `/Apps/<your-app-name>` folder rather than full account access; switch to "Full Dropbox" later if you ever need to write outside that folder).
3. Name it anything (e.g. "Exotic Push Engine Backups") and create it.
4. On the app's **Permissions** tab, enable `files.content.write` and `files.content.read`, then click **Submit** at the bottom of that tab.
5. On the **Settings** tab: copy the **App key** and **App secret** into `DROPBOX_APP_KEY`/`DROPBOX_APP_SECRET`. Under **OAuth 2 → Redirect URIs**, add `https://your-dashboard-domain/api/dashboard/backup/dropbox/callback` and set the same URL as `DROPBOX_REDIRECT_URI`.

That's it — no business verification, no waiting period. If you'd rather skip Dropbox entirely, **Google Drive works the same way and reuses the OAuth client you're already setting up for sign-in and Sheets export** — one fewer provider to manage.

## Sites

A "site" is one Exotic-owned website. Each site has its own VAPID key pair — generated once, never shared.

- `POST /api/sites` — create. `platform` is one of `WordPress | Magento | Node.js | Laravel | Other`.
- `POST /api/sites/:id/generate-vapid` — generates a new VAPID key pair via the `web-push` library and stores it on the site. Required before that site can register subscribers or receive pushes.
- `POST /api/sites/:id/rest-api-credentials` — generates the site-scoped REST API key id and auth token for CRM integrations.
- `GET/PATCH /api/sites/:id`, `GET /api/sites`.
- `DELETE /api/sites/:id` — super-admin only. The site must already be `inactive` (rejects with 400 otherwise) since campaigns and subscribers reference it by foreign key. Audit-logged. The dashboard exposes this as a "Delete Site" button on the site detail page.

### REST API credentials

Each site can issue one REST API credential pair for CRM-driven actions and scheduling:

- `X-EPE-Site-Key: <rest_api_key_id>`
- `Authorization: Bearer <rest_api_auth_token>`

The dashboard exposes this under `Site Settings -> Integrations -> REST API`. The API also exposes `GET /api/sites/:id/rest-api/identity` as a protected verification endpoint for CRM systems that need to confirm the credentials before using downstream site-scoped actions.

Dashboard: `/sites` (list, with an "Add Site" button), `/sites/new`, `/sites/:id` (detail — VAPID keys, SDK snippet, downloadable service worker + manifest), `/sites/:id/edit`, `/platform-health` (platform score ring plus database, queue broker, storage, queue depth, worker heartbeat, and delivery drilldowns), `/platform/backup-config` (backup provider setup, schedules, history, and restore guidance).
The platform health page also surfaces active alerts derived from queue backlog, worker heartbeat freshness, and component health.

## Subscribers

A subscriber is one browser's push subscription for one site.

- `POST /api/subscribers/register` — **public, no auth.** Called directly by the browser SDK after the user grants notification permission. Body: `siteId, subscriptionEndpoint, p256dhKey, authKey, browser, deviceType, language`. `country` is optional — the API resolves it from the `cf-ipcountry` header when available and falls back to `"Unknown"`.
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

## Mobile push

Native APNs/FCM delivery for an iOS/Android app, parallel to browser push. Full developer guide: [docs/mobile-push-integration.md](./docs/mobile-push-integration.md).

- Staff configure per-site APNs (key id, team id, bundle id, `.p8` key) and/or FCM (project id, client email, service account key) credentials in the dashboard's Mobile Push panel, plus generate site-scoped REST API credentials (key id + auth token) in the REST API panel.
- The app itself registers/refreshes/invalidates its own device tokens and reports clicks via `POST/PATCH /api/sites/:siteId/mobile-devices/*` — authenticated with those REST API credentials, not a staff login. There is no separate dashboard step to "add" a device; registration is entirely app-driven.
- `POST /api/mobile-push/dispatch` (staff-only) queues a send to all eligible devices for a site/platform on the `mobile-push` BullMQ queue, same retry (3x, exponential backoff) and idempotency model as browser push.
- The **worker** sends via real protocol implementations — JWT-signed APNs over HTTP/2, FCM's v1 `messages:send` REST API — not a stub. A device that APNs/FCM reports as gone (404/410) is automatically marked `expired` and excluded from future sends.
- Delivery and click events are logged per-device (`mobile_push_events`, `mobile_push_click_events`), same shape as browser push's `push_delivery_events`.
- Credentials are masked on read — private keys are write-only and never sent back to the dashboard after saving.
- `GET /api/sites/:siteId/mobile-devices` (staff-only, paginated, filterable by `platform`/`status`) backs a per-device table in the dashboard's Mobile Push panel — not just aggregate counts. Staff can revoke an individual device (`PATCH /api/mobile-devices/invalidate`), which marks it `invalid` and excludes it from future sends.

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

The API supports two campaign media backends:

- `CAMPAIGN_MEDIA_STORAGE_BACKEND=local` stores uploaded media on the VM filesystem under `CAMPAIGN_MEDIA_STORAGE_ROOT`
- `CAMPAIGN_MEDIA_STORAGE_BACKEND=s3` uses S3-compatible object storage and requires bucket, region, and credential settings

For the current VM setup, local filesystem storage is the default and requires no Cloudflare R2 or other object-storage account. If you later move to object storage, prefer Cloudflare R2 for this project.

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

Two related but distinct dashboard pages: **Automations** (`/automations`) manages the rule *definitions*; **Workflow** (`/workflow`) is the RSS feed manager and live event log for the engine that runs them.

- An automation (`GET/POST/PATCH/DELETE /api/automations(/:id)`) is `{ siteId, triggerEvent, status: active|paused, actions }`. Trigger events: `subscriber_registered | page_visit | click | api_event | rss_item_published`. Actions: `send_notification` (title/message/url/image/icon/buttons), `add_tag`/`remove_tag`, or `webhook` (url/method/payload).
- `POST /api/workflow/events` records a trigger event (site, trigger, optional subscriber/campaign, payload) and synchronously executes every matching active automation for that site, marking the event `pending → completed`/`failed`. `GET /api/workflow/events` inspects the log. `subscriber_registered` fires automatically from real subscriber registration; `page_visit`/`api_event` are reported via the public `/workflow/track` endpoint (browser SDK, server-to-server); `click` fires from real push-click tracking.
- RSS: `POST/GET/PATCH/DELETE /api/workflow/rss-feeds(/:id)` plus `POST /api/workflow/rss-feeds/:id/poll` for an on-demand check. A `@Cron("*/15 * * * *")` job polls every active feed automatically, parses RSS/Atom, and fires `rss_item_published` the first time a new item's GUID is seen.
- The dashboard's `/workflow` page shows feed controls, a hero with feed/completed/pending/failed counts, and a recent-events feed; `/automations` shows summary cards (sites/rules/active rules) and the rule library itself.

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
- `GET /api/analytics/export?report=content-performance&days=30&format=csv|xlsx|pdf` — export for the current analytics views.
- The export menu on the analytics performance card (the icon next to the report tabs) also offers **Export to Google Sheets**, which pushes the active report straight into a new spreadsheet instead of downloading a file.
- The dashboard now has dedicated `/analytics`, `/segments`, `/automations`, and `/workflow` surfaces covering reporting, audience targeting, event-driven rules, and RSS management.
- The analytics command center uses a full-width performance card with interactive line charts, compact date presets plus custom ranges, and comparison mode. Chart hover and keyboard navigation reveal the exact point being inspected.
- Reporting drilldowns stay scoped to the selected site unless `All Sites` is selected, and the campaign panel lets editors switch campaign context without leaving the page.

**Click-through rate is computed against successfully handed-off pushes (`sent + delivered`), not against total attempts.** A push that failed or expired was never shown to anyone, so it shouldn't dilute the CTR denominator.

This is still a staged analytics layer — country, site, time-of-day, and controlled content-taxonomy reporting are live, and export formats now include CSV, Excel, PDF, and Google Sheets. See [Known gaps](#known-gaps).

### Setting up "Export to Google Sheets"

This reuses the same OAuth client as Google sign-in and the Drive backup connection (`GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET`), but requests Sheets write access instead of Drive or identity, so Google requires its own registered redirect URI. One-time setup in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. Enable the **Google Sheets API** on the same project used for sign-in/backups (the Drive API enabled for backups is a separate API and doesn't cover this).
2. Open the existing OAuth 2.0 Client ID (the one already used for `GOOGLE_OAUTH_CLIENT_ID`) and add this exact URL to **Authorized redirect URIs**:
   ```
   https://your-dashboard-domain/api/dashboard/analytics/export/google-sheets/callback
   ```
3. Set `GOOGLE_SHEETS_OAUTH_REDIRECT_URI` to that same URL in `services/api/.env` (see `.env.example`).

Until that redirect URI is registered and the env var is set, the export menu still shows "Export to Google Sheets" but disables it with a "Not set up for this server yet" note rather than failing silently.

## Dashboard

Next.js 15 App Router. Pages: `/` (overview), `/analytics`, `/sites`, `/sites/new`, `/sites/:id`, `/sites/:id/edit`, `/campaigns`, `/campaigns/new`, `/campaigns/:id`, `/campaign-taxonomies`, `/subscribers`, `/subscribers/:id`, `/segments`, `/automations`, `/workflow`, `/audit-logs`, `/platform-health`, `/platform/backup-config`, `/access-control`, `/login`.

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
- An `epe_push_engine_csp_nonce` filter lets a host site inject its CSP nonce into both the inline config script and the SDK `<script>` tag, for sites running a strict Content-Security-Policy.
- The SDK fires a `page_visit` workflow trigger on every page load via the public `/workflow/track` endpoint (see [Workflow automation](#workflow-automation)).

To onboard a new WordPress site: create the site in EPE, set the branding and VAPID details in the site record, install the plugin, then paste the API URL + Site Key into the plugin settings.

## Other platform integrations

WordPress has a working installable plugin (see [WordPress plugin](#wordpress-plugin) above). The other three platforms are all install-and-go now — no manual file publishing, no static assets to keep in sync by hand:

- **Magento** — a production module scaffold under [`integrations/magento/Exotic/PushEngine/`](integrations/magento/Exotic/PushEngine/), installed through the normal Magento module pipeline.
- **Node.js** — [`integrations/node/`](integrations/node/README.md). `mountEpePush(app, config, express.static)` registers `/push-sw.js`, `/manifest.json`, and the SDK on an Express app in one line; framework-agnostic generator functions are also exported for everything else.
- **Laravel** — [`integrations/laravel/`](integrations/laravel/README.md). `composer require epe/laravel-starter` registers the same three routes automatically — `manifest.json` and `push-sw.js` are generated from config on every request, never a stale published file.

`docs/phase-2-6-*.md` are the original planning notes for these, now pointing at the packages above.

## Production deployment

Full step-by-step runbook: [`infrastructure/deployment/cpanel.md`](infrastructure/deployment/cpanel.md). Summary of what exists:

- **`ecosystem.config.js`** (repo root) — PM2 process definitions for all three services. Each app loads its own `.env` by parsing it directly in the config file (PM2's built-in `env_file` option was tested and found to silently not apply the variables on the PM2 version used here — don't reintroduce it without re-verifying).
- **`services/api/scripts/migrate.mjs`** (run via `npm run migrate` from `services/api`) — idempotent migration runner. Tracks applied files in a `schema_migrations` table, so it's safe to run on every deploy, including the first one.
- **`infrastructure/nginx/epe.conf`** — reverse proxy config. Two things in here are easy to get wrong and were both bugs in an earlier version of this file: the API has a global `/api` route prefix that `proxy_pass` must preserve rather than strip, and the dashboard's own `/api/dashboard/*` BFF routes must be matched and routed to the dashboard (port 3000) *before* the generic `/api/*` block sends everything else to the real API (port 3001). Both are now correct and were verified against a real local nginx instance, not just read through.

All three of the above were actually run end-to-end locally (PM2 managing all three services, nginx proxying real requests through to them, a full login → create campaign → send → worker-processes-the-job round trip) before being considered done — not just written and assumed correct.

## Infrastructure runbooks

- [VM setup checklist](./VM_SETUP.md) — Proxmox VM sizing, Ubuntu bootstrap commands, package install order, environment file layout, PM2 startup, and Nginx reverse proxy wiring.
- [Proxmox remote access guide](./PROXMOX.md) — VPN-first access model plus the hardened port-forwarding fallback.

## Testing

```bash
npm run test --workspaces       # all three services + shared packages
npm run typecheck --workspaces
```

Each service uses Node's built-in test runner (`node --import tsx --test`), not Jest. Tests live alongside the code as `*.spec.ts` (API) or under `test/` (worker, dashboard).

## Known gaps

- **No automated PM2 boot-persistence test** — `pm2 save` + `pm2 startup` are documented in the runbook but haven't been tested through an actual server reboot, since that requires the real VPS.
