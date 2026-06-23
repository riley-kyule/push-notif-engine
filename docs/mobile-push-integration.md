# Native mobile push integration guide

This is the guide for the developer of an iOS/Android app that needs to register
devices with Exotic Push Engine (EPE) and receive native push notifications. It
replaces the old "Phase 4" planning note — this describes the system as it
actually works today, including the public, app-facing endpoints.

## 1. Prerequisites (done once by EPE staff, in the dashboard)

1. Open the site in the dashboard (`/sites/:id`).
2. Under **Mobile Push (APNs / FCM)**, enter the site's APNs (key id, team id,
   bundle id, `.p8` private key) and/or FCM (project id, client email, service
   account private key) credentials and save. Private keys are write-only — they
   are never sent back to the dashboard after saving.
3. Under **REST API**, click **Generate credentials**. This produces a
   site-scoped **API key id** and **auth token**. The auth token is shown once —
   store it securely in your app's build config / secrets manager. These are the
   same credentials used for CRM-driven campaign actions; mobile registration is
   just another authenticated use of them.

The mobile app never talks to the dashboard and never needs a staff login. It
only needs the site id (the UUID in the site's dashboard URL), the API key id,
and the auth token from step 3.

## 2. Authenticating as your app

Every endpoint below is scoped to one site and requires two headers:

```
X-EPE-Site-Key: <rest_api_key_id>
Authorization: Bearer <rest_api_auth_token>
```

The site id is part of the URL path, not a header — see the endpoints below.
There is no separate "device registration token" or QR-code flow: the same
REST API credential pair authenticates every request your app makes.

If the credentials are missing, wrong, or don't match the site id in the URL,
every endpoint returns `401 Unauthorized`. If the site id doesn't exist, you get
`404 Not Found`.

## 3. Endpoints

Base URL is the API's public origin (e.g. `https://push.example.com/api`).

### Register a device

```
POST /sites/:siteId/mobile-devices/register
Content-Type: application/json

{
  "platform": "ios" | "android",
  "deviceToken": "<APNs device token or FCM registration token>",
  "country": "US",        // optional, ISO 3166-1 alpha-2
  "language": "en"        // optional, ISO 639-1
}
```

Call this once after the user grants notification permission and you have a
device token from APNs/FCM. Safe to call again with the same token (it's
upserted, not duplicated).

Response: `{ "success": true, "data": { "id", "siteId", "platform", "deviceToken", "status", "country", "language", "lastSeenAt", "createdAt", "updatedAt" } }`

### Refresh a device token

```
POST /sites/:siteId/mobile-devices/refresh
Content-Type: application/json

{
  "platform": "ios" | "android",
  "currentDeviceToken": "<the token you previously registered>",
  "nextDeviceToken": "<the new token the OS just issued>"
}
```

iOS and Android occasionally rotate the device token. Call this when the OS
hands you a new one (`didRefreshRegistrationToken` on Android, a new value from
`didRegisterForRemoteNotificationsWithDeviceToken` on iOS) instead of calling
`register` again, so delivery history stays attached to the same device record.
Returns `404` if `currentDeviceToken` isn't currently registered for this site.

### Invalidate a device

```
PATCH /sites/:siteId/mobile-devices/invalidate
Content-Type: application/json

{
  "platform": "ios" | "android",
  "deviceToken": "<token to stop sending to>"
}
```

Call this when the user logs out, disables notifications, or uninstalls is
detected another way. EPE also auto-invalidates a token on its own the first
time APNs/FCM reports it as gone (HTTP 404/410) — you don't need to react to
delivery failures yourself, just clean up on explicit user action.

### Report a notification tap

```
POST /sites/:siteId/mobile-devices/click
Content-Type: application/json

{
  "platform": "ios" | "android",
  "deviceToken": "<the device that received the push>",
  "destinationUrl": "<the URL/deep link the notification pointed to>"
}
```

Call this from your notification-tap handler so click-through analytics in the
dashboard reflect mobile engagement, not just web.

## 4. What a push notification looks like

EPE doesn't send raw APNs/FCM payloads you have to reverse-engineer — every
push carries the same four fields regardless of platform:

```json
{ "title": "...", "body": "...", "url": "...", "icon": "...", "image": "..." }
```

- **iOS (APNs):** delivered as a standard `aps.alert` (title/body) push, with
  `url`, `icon`, and `image` as top-level custom keys your notification service
  extension or app delegate can read.
- **Android (FCM):** delivered as an FCM `notification` (title/body) plus a
  `data` payload containing `url`, `icon`, `image`.

Use `url` as the deep link / in-app destination when the user taps the
notification, and report the tap via the click endpoint above.

## 5. Error handling

All endpoints return `{ "success": false, "error": { "message": "..." } }` (or
a NestJS-style `{ "message", "error", "statusCode" }` body) on failure. Treat
`401`/`404` as configuration problems (wrong credentials or site id — fix and
redeploy, don't retry per-request) and `400` as a validation problem (check
your payload against the shapes above). There's no rate limit specific to
these endpoints beyond the platform's general per-IP limit, so normal app
usage (one register call per install, occasional refresh) is unaffected.

## 6. What EPE handles for you

- Delivery via real APNs (JWT-signed HTTP/2) and FCM (v1 API) — not a stub.
- Retries on transient failures (BullMQ, 3 attempts with exponential backoff),
  without double-delivering on a retried job.
- Automatic device expiry when APNs/FCM reports a token as gone.
- Per-site, per-device delivery and click event history, visible in the
  dashboard's analytics and the site's Mobile Push panel (aggregate counts by
  platform/status — no per-device drill-down UI yet, see the README's Known
  gaps).
