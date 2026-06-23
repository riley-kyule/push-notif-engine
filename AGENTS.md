# AGENTS.md

# Exotic Push Engine (EPE)

Version: 1.0

---

## Project Overview

The Exotic Push Engine (EPE) is a self-hosted web push notification platform built specifically for Exotic Online Advertising. Push is delivered through the browser on desktop and mobile, and natively via APNs/FCM for Exotic's in-development mobile app (see `docs/mobile-push-integration.md`).

The platform is designed to replace third-party push notification providers and provide centralized notification management for all Exotic websites.

This project is NOT a SaaS platform.

This project is NOT multi-tenant.

This project serves only Exotic-owned websites.

Future SaaS functionality may be developed under a separate project.

---

# Mission

Build a highly scalable browser push notification platform capable of managing millions of subscribers across more than 110 Exotic websites.

Primary objectives:

* Own subscriber data
* Eliminate third-party push costs
* Centralize campaign management
* Improve audience engagement
* Provide advanced analytics
* Reach mobile users through browser-based web push (Android/iOS) and native push (APNs/FCM) for the in-development mobile app

---

# Core Principles

## Principle 1: Self Hosted First

All critical services must be capable of running on infrastructure controlled by Exotic Online Advertising.

Avoid dependencies on paid third-party notification platforms.

Allowed:

* PostgreSQL
* Redis
* Cloudflare
* Nginx
* Linux

Avoid:

* OneSignal
* WebPushr
* PushEngage

---

## Principle 2: Scalability

Design for:

* 5,000,000+ subscribers
* 110+ websites
* 100,000+ notifications per campaign

Scaling model: EPE is deployed on a single cPanel VPS without Docker. Scaling within this constraint is achieved through PM2 multi-process clustering for the API and multiple BullMQ worker processes for delivery throughput. Never make implementation decisions that prevent moving to multiple servers in the future, but do not over-engineer for horizontal distribution that is not currently required.

---

## Principle 3: Performance

API responses should be fast.

Target:

* Dashboard response < 500ms
* Campaign creation < 2 seconds
* Web push subscriber registration throughput: > 10,000 new subscriptions processable per minute at peak load

Avoid N+1 queries.

Use indexes appropriately.

---

## Principle 4: Security

Subscriber data is sensitive.

Requirements:

* HTTPS only
* JWT authentication
* Refresh tokens
* Password hashing using Argon2
* RBAC authorization
* Rate limiting
* Audit logs

Never store secrets in source code.

Never commit:

.env
keys
certificates
private tokens

---

## Principle 5: Maintainability

Code should be understandable by future developers and AI agents.

Requirements:

* Strong typing
* Clear naming
* Modular architecture
* Comprehensive documentation

Avoid clever code.

Prefer readable code.

---

# Technology Stack

## Frontend

* Next.js
* TypeScript
* TailwindCSS
* Shadcn UI
* React Query

## Backend

* NestJS
* TypeScript

## Database

* PostgreSQL

## Cache

* Redis

## Queue

* BullMQ

## Object Storage

* Cloudflare R2 (preferred — zero infrastructure overhead, already in approved vendor list, replaces MinIO which requires manual process management on the VPS)

## Monitoring

* Prometheus
* Grafana
* Loki

## Containerization

* No container dependency required for deployment
* cPanel VPS-compatible runtime deployment

---

# Architecture

Frontend

Dashboard Application

Backend

API Gateway

Modules:

* Auth
* Sites
* Subscribers
* Campaigns
* Segments
* Analytics
* Automations
* Notifications

Infrastructure

* PostgreSQL
* Redis
* Workers

---

# Feature Scope

## Included

### Site Management

Manage Exotic websites.

Store:

* Name
* URL
* Country
* Language
* Logo
* Push Credentials (VAPID key pair per site, stored encrypted)
* Platform type (WordPress / Magento / Node.js / Laravel / Other)

### WordPress Plugin

A WordPress plugin is a required first-class deliverable. Without it, EPE cannot be practically deployed to the majority of Exotic's sites.

The plugin must:

* Serve the EPE service worker file from the WordPress site's own origin at `/push-sw.js`
* Inject the EPE SDK into every page via `wp_enqueue_script`
* Expose a settings page in wp-admin for API URL and site key
* Support WordPress Multisite
* Declare required CSP allowlist additions in the plugin readme

### Magento 2 Module

A Magento 2 module is required for the single Magento site.

The module must:

* Inject the EPE SDK via layout XML
* Place the service worker file in the Magento webroot during module install
* Add required CSP entries to `csp_whitelist.xml`

### Subscriber Management

Store:

* Browser / Platform (Chrome, Firefox, Edge, iOS Safari)
* Device type (desktop / mobile / tablet)
* Country
* Language
* Subscription Endpoint
* Created Date
* Last Seen
* Status

Browser push subscriptions from WebPushr cannot be imported — they are VAPID-bound. All subscribers must be re-acquired organically through EPE's service worker. There are no device tokens to migrate as no native apps exist.

### Campaign Management

Create:

* Instant Campaigns
* Scheduled Campaigns
* Recurring Campaigns

Campaign fields:

* Title
* Message
* URL
* Image
* Icon
* Buttons

### Segments

Support:

* Country
* Browser
* Device
* Language
* Last Seen
* Click History

### Analytics

Track:

* Deliveries
* Failures
* Clicks
* CTR
* Subscriber Growth

### RSS Automation

Automatically generate campaigns from RSS feeds.

### A/B Testing

Support campaign variants.

### Notification Scheduling

Timezone-aware scheduling.

### Workflow Automation

Triggers:

* Subscribe
* Page Visit
* Click
* API Event

Actions:

* Send Notification
* Add Tag
* Remove Tag
* Webhook

---

# Explicitly Out Of Scope

The following are NOT part of this project:

* SaaS billing
* White-label functionality
* Multi-tenancy
* Subscription plans
* Customer invoicing
* Marketplace integrations
* Agency portals
* Reseller management

If future requirements require these features, create a separate project.

---

# Coding Standards

## TypeScript

Strict mode enabled.

Avoid:

any

Use:

* interfaces
* DTOs
* enums
* generics

---

## API Standards

REST API only.

Naming:

GET /sites

POST /sites

GET /campaigns

POST /campaigns

Avoid inconsistent naming.

---

## Database Standards

Use migrations.

Never modify production schema manually.

Every table must include:

* id
* created_at
* updated_at

Use UUIDs where appropriate.

---

# Folder Structure

/apps
/dashboard

/services
/api
/workers

/packages
/ui
/shared
/types

/infrastructure
/nginx
/monitoring
/deployment

/docs

/scripts

---

# Queue Standards

All push delivery must happen through queues.

Never send notifications directly from API requests.

Flow:

Campaign Created
↓
Queue Jobs Created
↓
Workers Process Jobs
↓
Delivery Results Stored

---

# Push Notification Standards

## Browser Push (Desktop and Mobile)

Browser-based push to Android and iOS mobile users is delivered through the Web Push Protocol and VAPID, same as desktop — no APNs/FCM involvement in this path. Exotic's in-development native mobile app uses a separate, real APNs/FCM delivery path instead (`services/api/src/mobile-push/`, `docs/mobile-push-integration.md`); the two are independent.

Use:

* Web Push Protocol
* VAPID (one key pair per site)
* Service Workers

Supported platforms:

* Chrome desktop
* Chrome Android (web push works identically to desktop)
* Firefox desktop
* Edge desktop
* iOS Safari 16.4+ (requires Web App Manifest per site — see below)

Explicitly NOT supported by this browser-push pipeline:

* macOS Safari — requires per-domain Apple Website Push ID certificates. Descoped.
* Native app push (APNs, FCM) is a separate, already-built delivery path (`services/api/src/mobile-push/`, `services/worker/src/mobile-push.*`, integration guide at `docs/mobile-push-integration.md`). It does not go through this browser pipeline.

## iOS Safari Web Push Requirements

iOS Safari 16.4+ supports Web Push via standard VAPID. No Apple certificates required. One additional requirement: the page must reference a Web App Manifest.

The manifest minimum:

```json
{
  "name": "Site Name",
  "short_name": "Site",
  "display": "standalone",
  "icons": [{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" }]
}
```

The EPE WordPress plugin must serve this manifest at `/manifest.json` and inject the `<link rel="manifest">` tag into every page. Other platforms (Magento, Node.js, Laravel) must include manifest serving in their integration guides.

Without the manifest, iOS Safari will not show the push permission prompt and subscriptions cannot be collected on iOS.

## Service Worker Distribution

Service workers must be served from the same origin as each site. EPE's API server cannot serve them on behalf of other domains.

Per platform:

* WordPress: EPE plugin serves SW dynamically at `/push-sw.js` and manifest at `/manifest.json`
* Magento: EPE module places both files in the Magento webroot
* Node.js / Laravel / Other: Both files downloaded from the EPE dashboard and deployed manually to the site webroot

The VAPID public key must be injected into the service worker at serve time from site configuration. Never hardcode keys.

## Delivery Error Handling

* 410 Gone from push service — subscription is invalid, remove immediately, do not retry
* 404 Not Found from push service — same as 410, remove immediately
* 429 Too Many Requests — back off exponentially, never retry immediately
* 5xx from push service — retry with backoff, max 3 attempts, then mark Failed
* All errors logged with site ID, subscriber ID, campaign ID, and full response

## CSP Awareness

Many WordPress security plugins enforce Content Security Policy headers that block external scripts and service worker registrations. The EPE WordPress plugin must document the required CSP additions:

* `script-src`: EPE SDK origin
* `connect-src`: EPE API origin
* `worker-src 'self'`: service worker is served from same origin via plugin, so self is correct

Test the plugin against Wordfence and Sucuri CSP modes before release.

---

# Analytics Standards

Every notification event must be tracked.

Events:

* Sent
* Delivered
* Failed
* Clicked

Analytics must be generated from event data.

Do not store aggregated metrics as source-of-truth.

---

# Logging Standards

Use structured logs.

Every log entry should include:

* Timestamp
* Module
* Event
* Severity

Levels:

* INFO
* WARN
* ERROR

Avoid console.log in production.

---

# Monitoring Standards

Track:

* API latency
* Queue depth
* Worker failures
* Database health
* Redis health

Critical failures must generate alerts.

---

# Testing Requirements

Minimum coverage:

80%

Required:

* Unit Tests
* Integration Tests

Critical modules:

* Authentication
* Campaign Delivery
* Analytics
* Queue Processing

Must have integration coverage.

---

# Documentation Requirements

Every feature must include:

* Technical documentation
* API documentation
* Database documentation

New features without documentation are considered incomplete.

---

# AI Agent Instructions

When implementing features:

1. Read existing architecture first.
2. Reuse existing patterns.
3. Do not introduce new frameworks without approval.
4. Do not bypass queues.
5. Do not bypass authentication.
6. Do not hardcode secrets.
7. Update documentation when modifying features.
8. Maintain backward compatibility where possible.
9. Prefer simplicity over cleverness.
10. Production readiness takes priority over rapid delivery.

When uncertain:

Choose the solution that is:

* More scalable
* More secure
* Easier to maintain

over the solution that is merely faster to implement.

---

# End of Document
