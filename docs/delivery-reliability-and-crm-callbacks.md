# Delivery reliability and CRM callbacks

This runbook covers the delivery safeguards added after the production worker
was moved to Docker, and the callback contract used by CRM-driven automatic
notifications.

## What caused the production failures

The worker was attached only to `push_internal`, a Docker network declared with
`internal: true`. It could reach PostgreSQL and Redis but had no route to public
DNS or push providers, producing `getaddrinfo EAI_AGAIN fcm.googleapis.com`.
The worker must join both `push_internal` and `push_egress`.

Automatic pushes exposed a second issue because they commonly target one
subscriber. The original circuit breaker opened only after ten transient
failures. A one-recipient job could therefore record its only attempt as failed
and still complete successfully, preventing BullMQ from applying its delayed
retries. Targeted browser jobs and small native-push jobs now fail the queue job
after an exhausted transient error. Successful recipients remain idempotent
across retries.

Browser delivery/click acknowledgements also now retry three times in every
generated service worker. Deployed WordPress, Magento, Node, and Laravel
integrations must be upgraded or regenerated to receive that change.

## CRM notification and callback contract

Send a site-scoped notification with the existing REST credentials:

```http
POST /api/sites/{siteId}/rest-api/notifications
X-EPE-Site-Key: {keyId}
Authorization: Bearer {token}
Idempotency-Key: {stable CRM event id}
Content-Type: application/json

{
  "title": "A new listing is available",
  "body": "Open it in the CRM",
  "url": "https://example.com/listing/123",
  "callbackUrl": "https://crm.example.com/hooks/epe"
}
```

`callbackUrl` is optional. When present, EPE stores it before queueing the push.
After the campaign reaches a final `sent` or `failed` state, EPE posts a summary:

```json
{
  "event": "notification.completed",
  "notificationId": "campaign-uuid",
  "siteId": "site-uuid",
  "status": "sent",
  "pending": 0,
  "sent": 1,
  "delivered": 0,
  "failed": 0,
  "expired": 0,
  "clicked": 0,
  "total": 1,
  "deliveryRate": 0,
  "clickThroughRate": 0,
  "occurredAt": "2026-07-23T09:00:00.000Z"
}
```

The callback receiver must return any `2xx` status within 15 seconds. EPE makes
eight attempts with exponential backoff from 30 seconds up to one hour. It
includes a stable `X-EPE-Callback-Id`, so the CRM should process callbacks
idempotently. If `CRM_CALLBACK_SIGNING_SECRET` is configured, EPE also sends:

```text
X-EPE-Signature: sha256=<HMAC-SHA256 of the exact raw JSON body>
```

`status: "sent"` means the worker completed provider handoff; it does not mean
every browser displayed the notification. The numeric `delivered` and `clicked`
fields come from asynchronous service-worker acknowledgements and can continue
to rise after the completion callback. Poll the notification status endpoint
when the CRM needs a later engagement snapshot.

The callback target is checked against EPE's SSRF protections both when it is
registered and immediately before each attempt. It must use HTTP(S), resolve
publicly, and must not resolve to loopback, private, link-local, or metadata
addresses.

The CRM can inspect callback state without waiting for delivery:

```http
GET /api/sites/{siteId}/rest-api/notifications/{notificationId}/callback
X-EPE-Site-Key: {keyId}
Authorization: Bearer {token}
```

Statuses are `pending`, `retrying`, `delivered`, and `exhausted`. The response
also includes attempt count, last HTTP status, timestamps, and the last error.

## Recovery and observability

- Platform Health probes browser FCM, Google OAuth/FCM v1, and APNs egress from
  the worker container.
- Browser and native provider incidents are persisted as `open`, `recovered`,
  or `exhausted` instead of being visible only in transient container logs.
- Failed-delivery analytics can selectively requeue unretired transient
  failures. The original event is claimed atomically and linked to the retry.
- Adaptive concurrency backs off when providers throttle or require retries and
  recovers gradually after healthy batches.
- The Segments page provides 30/60/90-day re-engagement templates.
- Campaigns can run deterministic 50/50 A/B variants; assignment remains stable
  across retries and variant results appear on campaign detail.

Useful database checks:

```sql
SELECT status, COUNT(*)
FROM notification_callbacks
GROUP BY status
ORDER BY status;

SELECT status, channel, provider, COUNT(*)
FROM push_delivery_incidents
GROUP BY status, channel, provider
ORDER BY status, channel, provider;

SELECT error_code, error_message, COUNT(*)
FROM push_delivery_events
WHERE status = 'failed'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY error_code, error_message
ORDER BY COUNT(*) DESC;
```

## Production rollout

1. Generate one encryption key with `openssl rand -base64 32`. Put the same
   `VAPID_KEY_ENCRYPTION_KEY` in the API and worker environment files. Back it
   up securely; losing it makes encrypted VAPID private keys unreadable.
2. Set `CRM_CALLBACK_SIGNING_SECRET` in the API environment and configure the
   CRM receiver with the same value.
3. Build the new image from the repository root:
   `docker build -f infrastructure/deployment/Dockerfile -t exotic-push-engine:<commit> .`.
   Set `PUSH_ENGINE_IMAGE` to that immutable tag, run migrations 031–033, and
   recreate API, dashboard, and worker containers.
4. After API and worker are running with the shared encryption key, run
   `npm run encrypt-vapid-keys --workspace @epe/api` once. Existing plaintext
   keys remain readable during the transition.
5. Run `scripts/validate-docker-deployment.sh compose.yaml`.
6. Upgrade or regenerate each site's service-worker integration.
7. Send one CRM notification with a unique idempotency key and callback URL.
   Confirm push status, callback status, signature verification, and exactly
   one CRM-side event.

The tracked Docker baseline is
`infrastructure/deployment/compose.production.yaml`. PostgreSQL and Redis stay
on the internal network; only services that need public traffic receive an
egress-capable network.

## Restore drill

Validate every downloaded backup archive:

```bash
scripts/verify-backup-restore.sh /path/to/epe-backup.tar.gz
```

For a full drill, create a disposable empty database whose name contains
`restore_drill`, then supply its URL:

```bash
scripts/verify-backup-restore.sh /path/to/epe-backup.tar.gz \
  postgresql://epe:password@127.0.0.1/epe_restore_drill
```

The script rejects unsafe archive paths, validates the manifest and media count,
checks the custom-format dump, refuses a nonempty database, and verifies that
the restore created tables.
