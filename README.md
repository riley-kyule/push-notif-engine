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
- [Security](#security)
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

Each service needs its own `.env` (see `.env.example` in each of `services/api`, `services/worker`, `apps/dashboard`). None of the three load `.env` automatically at runtime in dev — `node dist/main.js` does not read `.env` files. Either export the variables in your shell before starting or inject them through Docker Compose in production.

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
BROWSER_PUSH_SEND_CONCURRENCY=25
BROWSER_PUSH_QUEUE_CONCURRENCY=1
BROWSER_PUSH_TRANSIENT_FAILURE_THRESHOLD=10

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
- `POST /api/sites/:id/generate-vapid` — generates a new VAPID key pair via the `web-push` library and stores it on the site. Required before that site can register subscribers or receive pushes. Every existing browser subscription on the site was created against the old public key and is permanently unrecoverable under the new one (no way to "fix" them after the fact), so this also immediately marks every currently-`active` subscriber on that site as `expired` (`SitesRepository.expireActiveSubscribers`) rather than leaving the subscriber count silently wrong until each one eventually fails a real send.
- `POST /api/sites/:id/rest-api-credentials` — generates the site-scoped REST API key id and auth token for CRM integrations.
- `GET/PATCH /api/sites/:id`, `GET /api/sites`. Once a site has a key pair, `PATCH` rejects a `vapidPublicKey` change unless `vapidPrivateKey` is sent in the same request (`SitesService.updateSite`) — the push service validates them as a pair, so changing one alone desyncs it from the other and breaks every existing subscriber's delivery with an unexplained 403, the same failure pattern as a real key rotation but with no warning. The dashboard's site edit form locks the public key field entirely once a site has one configured; `generate-vapid` (above) is the only supported way to change it, since it replaces both keys together and warns about the consequence first.
- `DELETE /api/sites/:id` — super-admin only. The site must already be `inactive` (rejects with 400 otherwise) since campaigns and subscribers reference it by foreign key. Audit-logged. The dashboard exposes this as a "Delete Site" button on the site detail page.
- The sites list's first column is the site's icon, so a site missing one is immediately visible while scanning the table instead of only discoverable by opening each site individually.

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
- Status values: `active | inactive | unsubscribed | expired`. A subscriber is auto-marked `expired` if a push to it returns HTTP 403/404/410 — the browser unsubscribed, or the push service permanently rejects that subscription's auth (revoked permission, cleared site data, or any other reason that specific registration is gone for good).

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

### Scaling to large sends

A single dispatch (one campaign, one automation fire, one segment) can fan out to hundreds of thousands of subscribers on a popular site, and the worker is built to take that without falling over:

- The recipient list is processed in batches of 5,000 (`SEND_BATCH_SIZE` in `browser-push.processor.ts`/`mobile-push.processor.ts`) instead of one giant in-memory array and one giant bulk insert for the whole job — bounds peak memory and keeps any single SQL statement a reasonable size.
- Pending delivery rows are inserted with `ON CONFLICT (job_id, subscriber_id) DO UPDATE` (migration `030_delivery_event_idempotency.sql`). Without this, a worker process killed mid-job (a deploy's PM2 restart, an OOM) followed by BullMQ's stalled-job retry would insert a brand new pending row per recipient on every retry instead of reusing the row from the previous attempt — at scale that both piles up duplicate rows and queues a second real push send to recipients the first attempt had already reached.
- The BullMQ `Worker`'s `lockDuration` is explicit (10 minutes) rather than the 30-second default, so a brief Redis hiccup delaying one lock renewal doesn't flag a long-running, hundred-thousand-recipient job as stalled and hand it to a second concurrent attempt.
- Queue producers cap completed/failed job retention (`removeOnComplete`/`removeOnFail`) so Redis memory can't grow unbounded from job history at sustained send volume.

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

### Sending to All Sites

A campaign is still always a single-site backend entity — there's no broadcast endpoint. The dashboard's campaign builder (`apps/dashboard/app/campaigns/new/campaign-builder-form.tsx`) offers an "All Sites" option in the Site selector that's a dashboard-only convenience: selecting it loops the create/send/schedule calls once per real site instead of sending one request. Segment targeting is disabled in this mode (a segment belongs to one site's subscriber base and can't carry across a broadcast — every site gets all its active subscribers instead). The result is reported as "N of M sites" rather than a single campaign id, and a partial failure on one site doesn't stop the others.

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

- An automation (`GET/POST/PATCH/DELETE /api/automations(/:id)`) is `{ siteId, triggerEvent, status: active|paused, actions }`. Trigger events: `subscriber_registered | subscriber_unsubscribed | page_visit | click | api_event | rss_item_published`. Actions: `send_notification` (title/message/url/image/icon/buttons), `add_tag`/`remove_tag`, or `webhook` (url/method/payload).
- `siteId` is nullable — a `null` siteId means the automation applies to every current and future site, evaluated alongside that site's own automations (`postgres-automations.repository.ts`'s `listActiveByTrigger` matches `site_id = $1 OR site_id IS NULL`). The dashboard's Automations page exposes this as an "All Sites" option in the Site dropdown.
- `POST /api/automations/seed-defaults` (body: `{ siteId: string | null }`) creates the default welcome push (title "Subscription Saved", message "You'll now get exclusive notifications from {site}") for one site, or — with `siteId: null` — one global automation covering every site. It's idempotent per scope (site-specific vs. global are checked independently), so re-running it never duplicates. The dashboard's "Quick start" panel on `/automations` calls this.
- A global (`siteId: null`) automation's `title`/`message`/`url` can contain `{{site_name}}`/`{{site_url}}` tokens, resolved against whichever real site the firing subscriber actually belongs to at send time (`services/api/src/workflows/workflow.service.ts`'s `resolveSiteTokens()`, called just before dispatching the push). This is what lets one automation stay accurate for every site without needing a copy per site — a per-site (non-null `siteId`) automation doesn't need the tokens since it already only ever fires for that one site, but they still work there too.
- `POST /api/workflow/events` records a trigger event (site, trigger, optional subscriber/campaign, payload) and synchronously executes every matching active automation for that site, marking the event `pending → completed`/`failed`. `GET /api/workflow/events` inspects the log. `subscriber_registered` fires automatically from real subscriber registration; `page_visit`/`api_event` are reported via the public `/workflow/track` endpoint (browser SDK, server-to-server); `click` fires from real push-click tracking.
- RSS: `POST/GET/PATCH/DELETE /api/workflow/rss-feeds(/:id)` plus `POST /api/workflow/rss-feeds/:id/poll` for an on-demand check. A `@Cron("*/15 * * * *")` job polls every active feed automatically, parses RSS/Atom, and fires `rss_item_published` the first time a new item's GUID is seen.
- The dashboard's `/workflow` page shows feed controls, a hero with feed/completed/pending/failed counts, and a recent-events feed; `/automations` shows summary cards (sites/rules/active rules) and the rule library itself.

## Analytics

All read from `push_delivery_events`, `subscribers`, and `campaigns` — no separate aggregation table, so numbers are always live.

- `GET /api/analytics/overview?days=30&siteId=` — totals: subscriber counts, active/total campaigns, delivery/click counts, overall delivery rate and CTR, plus `failedDeliveryReason`/`failedDeliveryReasonCount` — the single most common `error_code + error_message` combination among `push_delivery_events` rows with `status = 'failed'` in the window (`services/api/src/analytics/analytics.repository.ts`). Cross-site when `siteId` is omitted (the dashboard home page always omits it); every sub-query is scoped to that one site when it's passed (the dashboard's `/analytics` page passes the selected site, "All Sites" omits it the same way). Powers the "Failed deliveries" summary card, e.g. "Most common cause: 403 Received unexpected response code (109 events)". That exact phrase is the `web-push` library's own error message when a push service rejects the VAPID-signed request for a specific subscription. 403/404/410 all auto-expire that subscriber (see [Subscribers](#subscribers)), so once a delivery has actually failed once with one of these, it stops being retried and stops recurring in this count — a 403 reading in the hundreds reflects a backlog of already-dead subscriptions accumulated before that subscriber was expired, not an ongoing per-send failure. A spike concentrated on one specific site (most or all of that site's subscribers failing at once) is the signature of a VAPID key mismatch rather than ordinary subscription death — see the public key lock note under [Sites](#sites).
- `GET /api/analytics/campaigns/:campaignId` — per-campaign breakdown: `pending/sent/delivered/failed/expired/clicked`, `deliveryRate` (delivered ÷ total), `clickThroughRate` (clicked ÷ (sent + delivered)).
- `GET /api/analytics/sites/:siteId?days=30` — subscriber totals + the same delivery/click breakdown, scoped to one site, plus daily subscriber growth.
- `GET /api/analytics/sites/:siteId/subscriber-growth?days=30` — just the growth series.
- `GET /api/analytics/countries?days=30` — country performance grouped from subscriber country data and delivery events.
- `GET /api/analytics/sites-performance?days=30` — cross-site delivery comparison with subscriber counts.
- `GET /api/analytics/time-performance?days=30` — hour-by-hour delivery and click volume in UTC.
- `GET /api/analytics/content-performance?days=30` — campaign performance grouped by controlled content taxonomy.
- `GET /api/analytics/failed-deliveries?siteId=&pushType=campaign|automation|manual&reason=&limit=&offset=` — the individual `push_delivery_events` rows behind the "Failed deliveries" count, not just the aggregate. Each row resolves which push actually caused it: `campaign_id` set → `pushType: "campaign"` with the campaign's name; `automation_id` set → `"automation"` with the automation's name; neither → `"manual"` (a one-off `POST /browser-push/dispatch`, no campaign or automation attached). `push_delivery_events.automation_id` is set by `WorkflowService.executeAction` whenever a `send_notification` action dispatches — it didn't exist before this column was added, so deliveries recorded before that migration show as `"manual"` even if an automation actually sent them. `GET /api/analytics/failed-deliveries/reasons` returns the distinct `error_code`/`error_message` combinations with counts, for the reason filter dropdown. The dashboard's `/analytics/failures` page is the filterable table UI for this (site, push type, and reason as real dropdowns, the same list-controls pattern as every other list page) — it's what "Failed deliveries" on the analytics/home overview cards links to.
- `GET /api/analytics/peak-hours?days=30&siteId=` — new-subscriber and click-through activity broken down by hour-of-day (0-23, UTC+3) across the whole selected range, for "when should we actually schedule sends." Distinct from `time-performance` above: that one shows a trend over the range (one point per day/hour-of-that-day), this one collapses every day in the range onto the same 24 hour-of-day buckets to reveal a recurring pattern. With `siteId`, it's that site's real totals; without one, every site's numbers are computed independently and **averaged**, not summed, so one large site can't single-handedly define what "all sites" looks like.
- `GET /api/analytics/export?report=content-performance&days=30&format=csv|xlsx|pdf` — export for the current analytics views.
- The export menu on the analytics performance card (the icon next to the report tabs) also offers **Export to Google Sheets**, which pushes the active report straight into a new spreadsheet instead of downloading a file.
- The dashboard now has dedicated `/analytics`, `/segments`, `/automations`, and `/workflow` surfaces covering reporting, audience targeting, event-driven rules, and RSS management.
- Reporting drilldowns stay scoped to the selected site unless `All Sites` is selected, and the campaign panel lets editors switch campaign context without leaving the page.

**Click-through rate is computed against successfully handed-off pushes (`sent + delivered`), not against total attempts.** A push that failed or expired was never shown to anyone, so it shouldn't dilute the CTR denominator.

### Dashboard analytics structure

The single, crowded `/analytics` page from earlier in the project has been split into dedicated routes, reachable through an expandable "Analytics" group in the sidebar instead of one generic link:

- **`/analytics`** — a lean overview: summary cards, a delivery-trend chart reacting to the selected range, the full date-range/comparison picker, and quick-link cards into every detailed report.
- **`/analytics/sites`**, **`/analytics/countries`**, **`/analytics/content`**, **`/analytics/time`** — each a dedicated, single-report page reusing the same chart/table explorer component, each with its own range picker and comparison mode (see below). `/analytics/time` also shows the "Best times to send" peak-hours panel.
- **`/analytics/failures`** — the filterable failed-deliveries table (site, push type, reason). No date-range picker — it's a different shape (a filtered raw event list, not an aggregate-by-something breakdown).
- **`/analytics/campaigns`** — drill into one campaign's own sent/delivered/clicked/CTR. No date-range picker either — a campaign has its own send date, not a sweep range to filter by.

**Custom date ranges filter by the actual calendar dates selected**, not a day count. Every report endpoint above accepts `startDate`/`endDate` (in addition to `days`) and, when given, filters `created_at` against the precise UTC instant those dates represent in UTC+3 (the timezone every other admin-facing timestamp in the dashboard now uses — see [Dashboard](#dashboard)), computed in application code rather than cast inside SQL, which would otherwise resolve in whatever timezone the Postgres session happens to be in. Before this, every report (including the overview) silently converted a custom range into "the last N days from right now," so picking, say, a specific week from two months ago actually showed last week's data instead — this is fixed at the source for every report listed above.

**Comparison mode** (previous period, or a second custom range) is available on the overview and on Sites, Countries, Content, and Time, rendered with the same `AnalyticsComparisonCard` component everywhere so the comparison view looks identical regardless of which report it's on.

This is still a staged analytics layer — country, site, time-of-day, peak-hours, and controlled content-taxonomy reporting are live, and export formats include CSV, Excel, PDF, and Google Sheets. See [Known gaps](#known-gaps).

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

Next.js 15 App Router. Pages: `/` (overview), `/analytics` (+ `/analytics/sites`, `/countries`, `/content`, `/time`, `/failures`, `/campaigns`), `/sites`, `/sites/new`, `/sites/:id`, `/sites/:id/edit`, `/campaigns`, `/campaigns/new`, `/campaigns/:id`, `/campaign-taxonomies`, `/subscribers`, `/subscribers/:id`, `/segments`, `/automations`, `/workflow`, `/audit-logs`, `/platform-health`, `/platform/backup-config`, `/access-control`, `/login`.

- **Auth:** `middleware.ts` gates every route except `/login` and `/api/dashboard/auth/*` on the presence of the `epe_access_token` cookie.
- **Date/time formatting is standardized**: every admin-facing timestamp (Last Seen, joined dates, audit log entries, platform health, backup history, etc.) renders as `dd/mm/yyyy-hh:mm:ss` in UTC+3 via `app/_components/format-date.ts`'s `formatDisplayDateTime`/`formatDisplayDate`, regardless of the server's or browser's own locale/timezone. A campaign's `Scheduled At` is the one exception — it's shown in the **target site's own local timezone** (`formatDisplayDateTimeInZone`) instead, since "when did I actually tell this site's campaign to fire" is the more useful reading there than an admin's own UTC+3. This is purely a display concern — the worker's actual send timing already used each site's real IANA timezone before this (see [Campaigns](#campaigns)) and is unaffected.
- **Data fetching:** server components call the real NestJS API directly via `lib/server-api.ts`'s `apiFetch`/`apiJson`, which attach the Bearer token from the cookie automatically.
- **Client-side mutations** (forms, action buttons) go through `/api/dashboard/*` route handlers, which proxy to the NestJS API with the same cookie-based auth. None of these routes touch Postgres directly — they're a thin pass-through layer.
- **Fallback data:** several `_data/*.ts` files keep small hardcoded fallback objects (e.g. `fallbackSiteChoices`) used only if the API call fails or returns nothing — this is what lets the dashboard render something reasonable in a broken-API scenario, not a feature to rely on. This silent fallback is exactly what made a real bug invisible in production: `ListAutomationsQueryDto` was missing `@Type(() => Number)` on `limit`/`offset` (every sibling list DTO has it), so the real `GET /automations` call failed validation on every request and `/automations` rendered the hardcoded `fallbackAutomations` mock entries (`automation-1`/`automation-2`, fake non-UUID ids) indistinguishably from real data — clicking Edit/Delete/Pause on them then 500'd against the real API, since those ids don't exist. If a page looks populated but every mutation on it 500s, check whether the list endpoint behind it is actually erroring and being masked by a fallback before assuming the mutation logic itself is broken.
- **Error and success notifications** surface as toasts (`app/_components/toast.tsx`'s `ToastProvider`/`useToast()`), stacked bottom-right via a `createPortal` into `document.body`, auto-dismissing (errors stay up longer than success messages) and individually dismissible. Every form across the dashboard uses this instead of an inline status paragraph that could sit below the fold on a long page. `lib/api-client.ts`'s `postJson`/`extractApiErrorMessage` is the one shared client-side fetch helper forms should use to get a toast-ready error message, rather than each component re-parsing the response body itself.
- **API error responses are normalized.** `services/api/src/common/http-exception.filter.ts` is a global NestJS exception filter that turns every thrown error — `HttpException`, class-validator failures, or an unexpected exception — into `{ success: false, error: { message, statusCode } }`, joining class-validator's per-field message array into one sentence rather than surfacing only the first error. 5xx errors get a generic message instead of leaking internals (stack traces, DB driver errors) to the client.
- **Page transitions:** `app/_components/page-transition.tsx` wraps `{children}` in the root layout with a `<div key={usePathname()}>`, so a real route change forces a remount that retriggers a short CSS fade-in (`globals.css`'s `.page-transition`/`@keyframes page-fade-in`). There's no "isNavigating" boolean to track, so browser back/forward can't get stuck mid-transition — the fade is just a side effect of the route changing, the same mechanism that already drives the navigation itself. Query-param-only changes (sorting, paging, filtering on the same route) don't retrigger it, since `usePathname()` ignores the query string.
- **List pages** (Sites, Subscribers, Media Library, Activity Log) share a common URL-driven pattern via `app/_components/list-controls.tsx`: `PageSizeSelect` (25/50/100/200/500), `SortableHeader` (click a column header to sort by it), `Pagination`, `SearchBox`, and `FilterSelect` (a real `<select>`, always including an "All ___" option, never a fake button row). State lives entirely in the URL's search params, not React state, so the page is server-rendered and shareable/bookmarkable.
- **Duplicate-site prevention:** creating or renaming a site rejects a case-insensitive duplicate URL or name (`SitesService.assertNoDuplicate`), surfaced as a normal validation error toast rather than a generic 500/constraint-violation message.

## WordPress plugin

`integrations/wordpress/epe-push/` — the production integration path for the ~110 WordPress sites.

- Serves the service worker at `/push-sw.js` and a web app manifest at `/manifest.json` (both via rewrite rules + `template_redirect`, not real files — see `serve_service_worker()`/`serve_manifest()` in `epe-push.php`).
- Injects the SDK (`assets/epe-sdk.js`) on every page via `wp_enqueue_scripts`.
- Admin settings page (`Settings → EPE Push`): API URL and Site Key only. Branding and opt-in prompt settings live in the EPE site settings and are fetched automatically.
- The SDK renders the custom EPE opt-in prompt, so sites do not rely on the native browser permission prompt as the primary user-facing experience.
- Once a browser is subscribed, the SDK shows a small, low-opacity bottom-left bell launcher (an inline SVG icon, not an emoji) with recent notifications and an unsubscribe action. The tray count is controlled per site in EPE. The launcher's position-avoidance heuristic only reacts to elements actually flush against the bottom edge now — the old, looser check treated any tall fixed/sticky element merely overlapping that corner (off-canvas nav drawers, full-height overlays many themes leave in the DOM) as something to dodge, which could push the bell to the top of the page or off-screen entirely.
- The SDK handles the full subscribe flow: register the service worker → request notification permission → `PushManager.subscribe()` with the site's VAPID key → POST the resulting subscription to `/api/subscribers/register`. If the browser already has an active subscription from before a VAPID key rotation, the SDK unsubscribes it first rather than reusing it as-is — `pushManager.subscribe()` otherwise just hands back the existing (now-mismatched) subscription, which silently fails every send afterward even though the subscriber row gets created successfully (the "count goes up, push never arrives" symptom).
- Site Settings → Integrations → REST API provides per-site API key and auth token credentials for CRM-managed push and scheduling use cases. The auth token is shown only once when generated.
- An `epe_push_engine_csp_nonce` filter lets a host site inject its CSP nonce into both the inline config script and the SDK `<script>` tag, for sites running a strict Content-Security-Policy.
- The SDK fires a `page_visit` workflow trigger on every page load via the public `/workflow/track` endpoint (see [Workflow automation](#workflow-automation)).

To onboard a new WordPress site: create the site in EPE, set the branding and VAPID details in the site record, install the plugin, then paste the API URL + Site Key into the plugin settings.

## Other platform integrations

WordPress has a working installable plugin (see [WordPress plugin](#wordpress-plugin) above). The other three platforms are all install-and-go now — no manual file publishing, no static assets to keep in sync by hand:

- **Magento** — a production module scaffold under [`integrations/magento/Exotic/PushEngine/`](integrations/magento/Exotic/PushEngine/), installed through the normal Magento module pipeline.
- **Node.js** — [`integrations/node/`](integrations/node/README.md). `mountEpePush(app, config, express.static)` registers `/push-sw.js`, `/manifest.json`, and the SDK on an Express app in one line; framework-agnostic generator functions are also exported for everything else.
- **Laravel** — [`integrations/laravel/`](integrations/laravel/README.md). `composer require epe/laravel-starter` registers the same three routes automatically — `manifest.json` and `push-sw.js` are generated from config on every request, never a stale published file.

All four integrations vendor the exact same `epe-sdk.js` (the WordPress plugin's copy is the source of truth — re-copy it into the other three if you fix something in one). The Node and Laravel READMEs' `apiUrl`/`EPE_API_URL` examples no longer suggest an `/api` suffix — the backend has no such prefix, and that suffix would 404 every request.

`docs/phase-2-6-*.md` are the original planning notes for these, now pointing at the packages above.

## Production deployment

The current production topology is Docker Compose; see the production section in [`docs/vm-cloudflare-tunnel.md`](docs/vm-cloudflare-tunnel.md#docker-compose-production-topology). The older PM2/cPanel path remains documented at [`infrastructure/deployment/cpanel.md`](infrastructure/deployment/cpanel.md) as a fallback.

Production safeguards now include worker-reported DNS/TLS connectivity to FCM, a dedicated worker egress network, and a circuit breaker that retries a whole BullMQ job instead of recording thousands of recipient failures during an infrastructure outage.

Legacy deployment artifacts that remain supported:

- **`ecosystem.config.js`** (repo root) — PM2 process definitions for all three services. Each app loads its own `.env` by parsing it directly in the config file (PM2's built-in `env_file` option was tested and found to silently not apply the variables on the PM2 version used here — don't reintroduce it without re-verifying).
- **`services/api/scripts/migrate.mjs`** (run via `npm run migrate` from `services/api`) — idempotent migration runner. Tracks applied files in a `schema_migrations` table, so it's safe to run on every deploy, including the first one.
- **`infrastructure/nginx/epe.conf`** — reverse proxy config. Two things in here are easy to get wrong and were both bugs in an earlier version of this file: the API has a global `/api` route prefix that `proxy_pass` must preserve rather than strip, and the dashboard's own `/api/dashboard/*` BFF routes must be matched and routed to the dashboard (port 3000) *before* the generic `/api/*` block sends everything else to the real API (port 3001). Both are now correct and were verified against a real local nginx instance, not just read through.

All three of the above were actually run end-to-end locally (PM2 managing all three services via `ecosystem.config.js`, nginx proxying real requests through to them, a full login → create campaign → send → worker-processes-the-job round trip) before being considered done — not just written and assumed correct.

When starting the stack manually, do not reuse a shell where `services/api/.env` was sourced. `PORT=3001` from the API will leak into the dashboard unless you start each process in an isolated env. The repo-level PM2 ecosystem file avoids that class of bug and is the preferred startup path. The helper scripts in `scripts/` wrap that flow:

- `scripts/pm2-bootstrap.sh` starts a clean PM2 stack from `ecosystem.config.js`
- `scripts/pm2-enable-autostart.sh` installs the PM2 systemd startup hook once per VM and saves the current process list
- `scripts/pm2-restart.sh` reloads the ecosystem file with updated env values
- `scripts/minor-update.sh` runs `git pull` followed by the PM2 restart flow
- `scripts/deploy-update.sh` runs the core update flow: install, build, migrate, then PM2 restart

The dashboard's `Platform Health` page also exposes two guarded maintenance actions for super admins:

- `Minor Update` for the pull-and-restart path
- `Core Update` for the full install/build/migrate/restart path

That panel also shows the local VM commit and the current GitHub `main` commit so you can see whether the VM is behind before triggering an update. `scripts/pm2-restart.sh` deliberately delays the actual `pm2 restart` by 5 seconds so it doesn't kill the very process sending the deploy action's HTTP response — the panel accounts for this: after the script finishes, it polls a `GET /api/health/deployment/pm2-status` endpoint (backed by `pm2 jlist`) for up to ~40 seconds, then shows each process's real status/uptime/restarts/memory and a toast confirming `epe-api`, `epe-worker`, and `epe-dashboard` actually came back online — not just that the deploy script itself exited 0.

## Infrastructure runbooks

- [VM setup checklist](./VM_SETUP.md) — Proxmox VM sizing, Ubuntu bootstrap commands, package install order, environment file layout, PM2 startup, and Nginx reverse proxy wiring.
- [Proxmox remote access guide](./PROXMOX.md) — VPN-first access model plus the hardened port-forwarding fallback.
- [VM update + Cloudflare Tunnel runbook](./docs/vm-cloudflare-tunnel.md) — safe git update flow on the VM, PM2 restart helper usage, dashboard/API timeout behavior, and public access through `push.exotic-online.com`.

## Security

A full audit pass (auth/authorization, injection surfaces, secrets/headers/dependencies) was run across the API, dashboard, and worker. What it found and fixed:

- **Privilege escalation (critical, fixed):** `PATCH /api/access-control/users/:id/role` only required `super-admin` or `admin` at the route level, with no check that the actor wasn't granting a role above their own — an admin could promote any user, including themselves, to super-admin. `AccessControlService.updateUserRole` now enforces a role-rank check: an actor can only assign a role at or below their own rank, and can't change the role of a user already more privileged than they are.
- **No server-side logout (high, fixed):** logging out only cleared the dashboard's cookies; the refresh token itself stayed valid server-side for its full 30-day lifetime regardless, so a copy captured before logout (XSS, a shared machine, a synced browser) kept working. `POST /api/auth/logout` now revokes it, called by the dashboard's logout route before clearing cookies.
- **SSRF on admin-supplied URLs (fixed):** RSS feed polling and automation webhook actions fetch a URL an admin configured, with nothing stopping that URL from pointing at an internal service or a cloud metadata endpoint (`169.254.169.254`). `services/api/src/common/ssrf-guard.ts`'s `assertSafeFetchTarget` resolves the hostname and rejects private/loopback/link-local/reserved ranges, re-checked immediately before every fetch (not just when the URL was saved) so DNS rebinding can't repoint an initially-public hostname at an internal one later.
- **File upload content-type spoofing (fixed):** campaign media uploads validated only the client-supplied `Content-Type` header — fully attacker-controlled — so an SVG (script-capable markup) could be uploaded claiming to be a PNG and served back with that claimed type. `services/api/src/campaign-media/image-type-sniffer.ts` detects the real format from the file's own magic bytes (PNG/JPEG/GIF/WebP only, no SVG/XML path at all) and that detected type is what gets stored and served, never the claimed one.
- **Missing security headers (fixed):** the API now runs `helmet()` (HSTS, `X-Content-Type-Options`, a restrictive CSP, etc.); the dashboard's `next.config.mjs` sets `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, and `Permissions-Policy`. Neither existed before.
- **Timing-unsafe comparison (fixed):** refresh token hash matching used `!==` on a SHA-256 digest; now `crypto.timingSafeEqual`. (The REST API site-key-id comparison flagged in the same pass was reviewed and left as-is — that ID is a public identifier, not a secret; the actual secret comparison there already goes through `argon2.verify`, which is timing-safe.)
- **Dependency vulnerabilities (fixed):** a stale lockfile plus a transitive `multer`/`uuid` pin had accumulated several known CVEs (multer DoS, uuid buffer bounds, a `next`/`postcss` XSS advisory). Root `package.json` now pins `overrides` for `multer`/`uuid`; a clean reinstall resolved the rest. `npm audit` reports zero vulnerabilities as of this pass.
- **Reviewed, confirmed safe by design:** SQL injection (every query is parameterized; the few dynamic `ORDER BY`/segment-filter builders use a fixed column allowlist, never raw interpolation of user input); command injection (`execFile` with argv arrays only, never a shell string, and only fixed script paths/args — the deployment actions panel never lets user input reach argv); mass assignment (global `ValidationPipe` has `whitelist: true` + `forbidNonWhitelisted: true`); the unauthenticated `GET /campaign-media/:id/file` endpoint (intentionally public — these are images embedded in push notifications shown to anonymous subscribers' browsers, not private documents); CORS (dynamically validated against registered site URLs, not a wildcard).
- **Already solid, no change needed:** Argon2 password hashing, JWT access/refresh separation with rotation, Google ID token verification (audience/issuer/email-verified checks), rate limiting on auth and public endpoints, audit logging coverage, and the global exception filter never leaking stack traces to the client.
- **Accepted, bounded risk:** an access token retains its embedded role for up to its own 15-minute lifetime even if the user is demoted or deactivated in that window (refresh tokens already re-check current role/`isActive` on every refresh, so this can't extend past 15 minutes). Postgres connection SSL isn't explicitly enforced — acceptable given the deployment model (Postgres runs alongside the API on the same single VPS, not reached over the public internet).

## Testing

```bash
npm run test --workspaces       # all three services + shared packages
npm run typecheck --workspaces
```

Each service uses Node's built-in test runner (`node --import tsx --test`), not Jest. Tests live alongside the code as `*.spec.ts` (API) or under `test/` (worker, dashboard).

## Known gaps

- **No automated PM2 boot-persistence test** — `pm2 save` + `pm2 startup` are documented in the runbook but haven't been tested through an actual server reboot, since that requires the real VPS.
