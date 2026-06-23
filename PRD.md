# Product Requirements Document

# Exotic Push Engine (EPE)

Version: 1.0

Owner: Exotic Online Advertising

Status: In Development (Phases 0–1 complete)

---

# Executive Summary

Exotic Push Engine (EPE) is a self-hosted web push notification platform built to manage subscriber engagement across all Exotic Online Advertising websites. Push is delivered through the browser on desktop and mobile, plus natively (APNs/FCM) for Exotic's in-development mobile app.

The platform replaces third-party push notification providers and centralizes subscriber management, campaign creation, automation, and analytics.

The platform must support more than 110 websites and millions of subscribers while remaining performant, scalable, and cost-effective.

---

# Business Goals

## Primary Goals

* Eliminate dependency on third-party push providers
* Centralize notification management
* Reduce operational costs
* Increase user engagement
* Improve subscriber retention
* Reach mobile users (Android and iOS) through browser-based web push

## Success Metrics

* Total Subscribers
* Subscriber Growth Rate
* Notification CTR
* Delivery Success Rate
* Campaign Engagement Rate

---

# Users

## IT Administrator

Manages infrastructure and platform settings.

## Marketing Team

Creates campaigns and analyzes results.

## SEO Team

Uses notifications to promote content.

## User Access Management

The platform must support distinct internal access roles:

* Super Admin - full platform access, including role and permission management
* Admin - can manage users, assign roles, and operate automations
* Sub-Admin - can access sites, site settings, analytics, subscribers, categories, and audience groups
* Customer Service - can access only the campaigns assigned to them
* User onboarding must capture first name, last name, email, and role; username is auto-generated from first name and passwords are generated automatically for the interim SSO transition period

---

# Functional Requirements

## Site Management

Users must be able to:

* Add websites
* Edit websites
* Disable websites
* Generate push credentials (VAPID key pair per site)
* Copy SDK installation snippet per site
* Download service worker file per site (generated with site VAPID key embedded)

Website Fields:

* Name
* URL
* Country
* Language
* Platform (WordPress / Magento / Node.js / Laravel / Other)
* Status
* Created Date

## CMS Integration

The majority of Exotic websites are WordPress. A first-class WordPress plugin is required. Without it, deploying EPE across 110+ WordPress sites is not operationally feasible.

### WordPress Plugin

The plugin must:

* Register and serve the EPE service worker from the site's own origin
* Inject the EPE SDK script into every page
* Deliver the site's VAPID public key to the browser
* Provide an admin settings page for API endpoint and site key configuration
* Support WordPress Multisite
* Not conflict with common security plugins (Wordfence, Sucuri, iThemes)
* Declare required CSP policy additions in plugin documentation

### Magento Module

A Magento 2 module is required for the single Magento site. The module must:

* Inject the EPE SDK via layout XML
* Serve the service worker file from the Magento webroot
* Declare FCM/push-related CSP exceptions in Magento's CSP whitelist configuration

### Node.js and Laravel Sites

These integrate directly via the EPE JavaScript SDK and REST API. No plugin required. SDK snippet is copied from the dashboard and added to the site's base layout.

## Service Worker Distribution

Service workers must be served from the same origin as each website. EPE's central server cannot serve service worker files on behalf of other domains.

Distribution strategy:

* WordPress: plugin serves the service worker file dynamically at `/push-sw.js`
* Magento: module places the service worker file in the webroot
* Node.js / Laravel: service worker file is downloaded from the EPE dashboard and deployed manually to the site's webroot
* The EPE dashboard must provide a "Download Service Worker" button per site that generates the correct file with the site's VAPID public key embedded

## Subscriber Re-acquisition Strategy

Because WebPushr browser push subscriptions cannot be ported (VAPID key incompatibility), EPE must support a parallel-run migration period.

During migration:

* Both WebPushr and EPE service workers are deployed on each site simultaneously
* New visitors subscribe to EPE
* Existing WebPushr subscribers continue to receive notifications via WebPushr until naturally re-subscribed through EPE on return visits
* WebPushr is decommissioned per site only when EPE subscriber volume on that site is deemed sufficient
* EPE dashboard must display per-site subscriber growth so the team can track re-acquisition progress

---

## Subscriber Management

Store:

* Browser
* Device Type
* Language
* Country
* Subscription Endpoint
* Last Seen
* Status

Users must be able to:

* Search subscribers
* Filter subscribers
* Export subscribers
* View subscriber history

Note on migration: Existing browser push subscriptions from WebPushr cannot be imported. They are cryptographically bound to WebPushr's VAPID keys. Browser push subscribers must be re-acquired organically through EPE's service worker once deployed on each site. There are no native app device tokens to migrate as Exotic has no mobile apps at this stage.

---

## Campaign Management

Campaign Types:

* Instant
* Scheduled
* Recurring

Fields:

* Title
* Message
* Image
* Icon
* URL
* Buttons
* Expiration Date
* Content Type
* UTM Defaults

Capabilities:

* Save Draft
* Clone Campaign
* Preview Campaign
* Schedule Campaign
* Auto-apply default UTM tags from content type

---

## Segmentation

Support:

* Country
* Browser
* Device
* Language
* Last Active
* Click History

Users can create dynamic segments.

---

## Push Delivery

System must:

* Queue notifications
* Retry failures
* Remove invalid subscriptions
* Track delivery status

Statuses:

* Pending
* Sent
* Delivered
* Failed
* Expired

---

## Mobile Web Push

Exotic does not currently have native mobile applications. Mobile push is therefore delivered entirely through the browser using the standard Web Push Protocol and VAPID — the same mechanism as desktop push. No APNs, no FCM native SDK, no app store involvement, zero additional cost.

### Android

Android Chrome supports Web Push natively. A subscriber on Android Chrome goes through the same subscription flow as a desktop user. No additional platform work is required beyond Phase 3 browser push delivery. FCM is used transparently by Chrome as its push relay — EPE never communicates with FCM directly.

### iOS Safari 16.4+

iOS Safari has supported Web Push via VAPID since iOS 16.4 (March 2023). It works the same as Android Chrome with one additional requirement: the page must link to a Web App Manifest (`manifest.json`). The manifest does not need to be complex — a name, icon, and `display` field are sufficient. The EPE WordPress plugin must serve this manifest automatically.

No Apple Developer certificates are required. No per-domain Apple configuration is required.

System must:

* Deliver web push to Android Chrome via standard Web Push Protocol
* Deliver web push to iOS Safari 16.4+ via standard Web Push Protocol
* Serve a Web App Manifest per site (required for iOS Safari subscription prompt)
* WordPress plugin must generate and serve the manifest automatically
* Track delivery and click events for both mobile channels

Supported mobile platforms:

* Android (Chrome 50+)
* iOS (Safari 16.4+)

Note on macOS Safari: Explicitly out of scope. Requires per-domain Apple Website Push ID certificates renewed annually — unacceptable operational overhead across 110+ sites.

## Native Mobile Push (Built — App In Development)

Status update: Exotic now has a native app in development, so Phase 4's native push foundation has been built out fully rather than left as a placeholder. APNs (iOS, JWT-signed HTTP/2) and FCM (Android, v1 API) delivery are live, with a public, app-facing device registration API (`/api/sites/:siteId/mobile-devices/*`) authenticated by the site's REST API key/token rather than a staff login — the app registers, refreshes, and invalidates its own device tokens directly. See `docs/mobile-push-integration.md` for the integration guide and the main `README.md`'s "Mobile push" section for the architecture summary.

---

## RSS Automation

Users can connect RSS feeds.

When a feed updates:

* Create campaign
* Send notification
* Log event

---

## Workflow Automation

Triggers:

* New Subscriber
* Page Visit
* Notification Click
* RSS Update

Actions:

* Send Push
* Add Tag
* Remove Tag
* Webhook

---

## Analytics

The analytics system must provide reliable internal reporting, independent of third-party push providers.

Main dashboard metrics:

* Total subscribers
* New subscribers today
* New subscribers in a selected date range
* Active subscribers
* Expired or inactive subscriptions
* Pushes sent
* Delivered estimate
* Total clicks
* CTR
* Failed pushes or expired endpoints
* Best-performing country
* Best-performing site
* Best-performing push time
* Best-performing content type

Required filters:

* Today
* Yesterday
* Last 7 days
* Last 30 days
* This month
* Previous month
* Custom date range

Required breakdowns:

* Country-based analytics
* Site-based analytics
* Individual push performance reports
* Time performance analytics
* Content performance analytics
* Subscriber growth analytics

Required export formats:

* CSV
* Excel
* PDF

Charts:

* Daily
* Weekly
* Monthly
* Sent vs delivered vs clicked
* Growth by site
* Growth by country

Analytics must be generated from immutable event data rather than stored aggregate source-of-truth metrics.

---

# Non Functional Requirements

Availability:

99.9%

API Response:

<500ms

Campaign Creation:

<2 seconds

Database:

PostgreSQL

Queue:

Redis + BullMQ

Authentication:

JWT

Encryption:

TLS 1.3

Deployment:

Must run on a cPanel-managed VPS without requiring Docker.

---

# Future Features

Not in current scope:

* Native Mobile Push — APNs (iOS) and FCM (Android) for when Exotic builds native mobile apps
* Email Campaigns
* WhatsApp Campaigns
* SMS Campaigns
* Multi-Tenant Support
* Billing
* White Label
