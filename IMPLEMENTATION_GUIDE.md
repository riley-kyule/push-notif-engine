# Implementation Guide

# Exotic Push Engine

Purpose:

Provide implementation instructions to AI coding agents.

---

# Development Phases

## Phase 0: Platform Foundation

Goal:

Establish the codebase, deployment model, and shared infrastructure patterns.

Features:

* Monorepo structure
* cPanel-compatible deployment
* VPS runtime without Docker dependency
* Nginx reverse proxy setup
* PostgreSQL connection layer
* Redis connection layer
* Shared TypeScript types and utilities

## Phase 1: Security and Access Control

Goal:

Deliver secure authentication and authorization before any business workflows.

Features:

* Authentication
* Login
* JWT
* Refresh Tokens
* RBAC
* Rate limiting
* Audit logging
* User access management
* Role and permission administration

Role model:

* Super Admin - full access, including editing roles and permissions
* Admin - all Sub-Admin access plus user creation, role assignment, and automations
* Sub-Admin - sites, site settings, analytics, subscribers, categories, audience groups, and campaign operations
* Customer Service - campaign-scoped access only
* User creation requires first name, last name, email, and role; username is generated from the first name and passwords are auto-generated for legacy compatibility

## Phase 2: Core Data Management

Goal:

Provide the basic entities needed to manage Exotic websites and subscribers.

Features:

* Site Management
* Subscriber Collection
* Site CRUD APIs
* Web Push Subscriber Registration API

## Phase 2.5: WordPress Plugin

Goal:

Deliver a production-grade WordPress plugin that enables one-click EPE deployment on any Exotic WordPress site. This is a gating dependency for reaching the majority of the 110+ site estate.

Features:

* Service worker served from WordPress origin at `/push-sw.js`
* Web App Manifest served at `/manifest.json` with `<link rel="manifest">` injected into every page (required for iOS Safari 16.4+ push subscription)
* EPE SDK injected via `wp_enqueue_script`
* Admin settings page (API URL, Site Key)
* WordPress Multisite support
* Tested against Wordfence and Sucuri CSP configurations
* Plugin readme includes CSP allowlist instructions for admins

This phase must complete before Phase 3 delivers the SDK, so both are tested together.

## Phase 2.6: CMS and Platform Integrations

Goal:

Deliver integration packages for the non-WordPress Exotic sites.

Features:

* Magento 2 module: SDK injection via layout XML, service worker + manifest.json in webroot, CSP whitelist entries
* Node.js integration guide: SDK snippet, service worker + manifest.json deployment, API registration
* Laravel integration guide: Blade layout snippet, service worker + manifest.json deployment, API registration
* Dashboard: "Download Service Worker" button per site, "Download manifest.json" button per site, "Copy SDK Snippet" button per site

## Phase 3: Browser Push Delivery (Desktop and Mobile)

Goal:

Deliver web push notifications to all supported browsers, on both desktop and mobile, using the standard Web Push Protocol — no APNs or native FCM in this pipeline. (Exotic's in-development native app uses a separate, real APNs/FCM delivery path; see Phase 4.)

Features:

* EPE JavaScript SDK (subscribe, unsubscribe, permission prompt handling)
* Service worker template generated per site with VAPID public key embedded, served from site origin
* Web App Manifest served per site — required for iOS Safari 16.4+ permission prompt
* BullMQ queue jobs for all push delivery
* Web Push Protocol + VAPID delivery
* Retry logic — exponential backoff, max 3 attempts
* Subscription pruning on 410 Gone or 404 Not Found responses
* Rate limit handling — respect 429 from push relays, back off, never flood
* Delivery status tracking: Pending → Sent → Delivered / Failed / Expired

Supported platforms:

* Chrome desktop
* Chrome Android (identical mechanism to desktop, no additional work)
* Firefox desktop
* Edge desktop
* iOS Safari 16.4+ (same VAPID mechanism — manifest.json per site is the only extra requirement, handled by Phase 2.5 and 2.6)

Not in scope: macOS Safari (descoped), APNs, native FCM.

Migration note: WebPushr parallel-run begins when Phase 3 is live on a site. WebPushr stays active per site until the EPE dashboard shows sufficient subscriber re-acquisition. The dashboard must display per-site EPE subscriber counts for this decision.

## Phase 4: Native Mobile Push (Built — App In Development)

Status: Exotic now has a native app in development, so this phase is built and live rather than reserved. See `docs/mobile-push-integration.md` for the app-facing integration guide.

Delivered:

* APNs HTTP/2 provider integration for iOS (p8 key, key ID, team ID per site)
* FCM HTTP v1 integration for Android (service account credentials per site)
* Public, app-facing device registration API (`/api/sites/:siteId/mobile-devices/*`), authenticated with the site's REST API key/token rather than a staff login
* Separate BullMQ queue for native mobile delivery, with the same retry/idempotency model as browser push
* Token refresh and invalidation handling, including automatic expiry when APNs/FCM reports a token as gone
* Mobile click tracking via deep links

## Phase 5: Campaign Management

Goal:

Enable campaign creation, scheduling, and lifecycle management.

Features:

* Campaign CRUD
* Draft saving
* Cloning
* Previewing
* Scheduling
* Content type selection
* Default UTM tag templates derived from content type

## Phase 6: Segmentation and Automation

Goal:

Support dynamic audience targeting and event-driven workflows.

Features:

* Segments
* RSS Automation
* Workflow Automation
* Triggers
* Actions
* Dashboard workflow console
* RSS feed management
* Workflow event logging
* Subscriber tag automation
* Event-driven RSS campaign routing

## Phase 7: Analytics and Reporting

Goal:

Track events and expose performance data for operational use.

Features:

* Event Tracking
* Delivery analytics
* Click analytics
* CTR reporting
* Dashboard charts
* Main analytics dashboard with date-range filters
* Country-based analytics
* Site-based analytics
* Time-of-day analytics
* Individual push performance reports
* Content performance analytics
* CSV export for analytics reports
* Subscriber growth analytics

Content performance analytics must use a controlled content taxonomy, and campaign content type selection must seed a default UTM template for the notification URL. Users may override UTM values when permitted by the campaign editor.

## Phase 8: Hardening and Scale

Goal:

Complete production readiness for high-volume Exotic workloads.

Features:

* Performance tuning
* Index optimization
* Integration test coverage
* Operational logging
* Monitoring hooks
* Failure recovery validation

---

# Required Architecture

Monorepo Structure

/apps
dashboard

/services
api
worker

/packages
shared
types
ui

/infrastructure
deployment
nginx
monitoring

/docs

---

# Build Order

Agents must build in phase order and complete each phase before starting the next.

Phase 0

Project setup and platform foundation

Deliverables:

* Monorepo
* PostgreSQL
* Redis
* cPanel VPS deployment configuration
* Nginx reverse proxy

Phase 1

Authentication and access control

Deliverables:

* Login
* JWT
* Refresh Tokens
* RBAC

Phase 2

Site and subscriber core data

Deliverables:

* Site CRUD APIs
* Dashboard Pages
* Web Push Subscriber Registration API
* Per-site platform type field

Phase 2.5

WordPress plugin

Deliverables:

* Service worker served from WordPress origin at /push-sw.js
* Web App Manifest served at /manifest.json (required for iOS Safari)
* SDK injection via wp_enqueue_script
* Admin settings page (API URL, Site Key, icon URL for manifest)
* Multisite support
* Tested against Wordfence and Sucuri CSP

Phase 2.6

CMS and platform integrations

Deliverables:

* Magento 2 module (service worker + manifest.json + CSP)
* Node.js integration guide
* Laravel integration guide
* Dashboard: Download Service Worker button per site
* Dashboard: Download manifest.json button per site
* Dashboard: Copy SDK Snippet button per site

Phase 3

Browser push delivery

Deliverables:

* EPE JavaScript SDK
* Service worker template (per-site VAPID key embedded)
* BullMQ queue jobs for web push
* Push dispatch via Web Push Protocol and VAPID
* Rate limit handling for FCM and Mozilla push services
* Retry logic (max 3, exponential backoff)
* Delivery status tracking

Phase 4

Native mobile push — built and live (Exotic has an app in development)

Deliverables:

* APNs HTTP/2 delivery
* FCM HTTP v1 delivery
* Public, app-facing device registration API (site REST API key/token auth, not staff login)
* Separate BullMQ queue for native mobile delivery
* Token refresh and invalidation
* Mobile click tracking

Phase 5

Campaign management

Deliverables:

* Campaign CRUD
* Scheduling

Phase 6

Segmentation and automation

Deliverables:

* Segments
* RSS Automation
* Workflow Automation
* Triggers
* Actions

Phase 7

Analytics and reporting

Deliverables:

* Event Tracking
* Dashboard Charts
* Date range filters
* Country analytics
* Site analytics
* Push performance reports
* Time performance breakdowns
* Content performance breakdowns
* Subscriber growth charts
* Exportable CSV, Excel, and PDF reports

Phase 8

Hardening and scale

Deliverables:

* Performance tuning
* Index optimization
* Integration test coverage
* Operational logging
* Monitoring hooks
* Failure recovery validation

---

# Coding Requirements

Use:

TypeScript

Avoid:

JavaScript

Use:

DTOs
Interfaces
Enums

Avoid:

any

---

# API Standards

Return format:

{
success: true,
data: {}
}

Errors:

{
success: false,
error: {}
}

---

# Database Standards

Use migrations.

Never modify schema manually.

Every table:

* id
* created_at
* updated_at

---

# Worker Standards

Workers must:

* Be idempotent
* Retry failures
* Log errors

Workers must never:

* Crash process
* Skip retries

---

# Analytics Standards

Every action becomes an event.

Examples:

campaign.sent

campaign.clicked

campaign.failed

subscriber.created

Analytics generated from events.

Never store analytics as source data.

---

# Testing Requirements

Coverage:

80%

Required:

* Unit Tests
* Integration Tests

No feature is complete without tests.

---

# Documentation Requirements

Every feature requires:

* Architecture Notes
* API Documentation
* Database Documentation

Missing documentation means feature is incomplete.
