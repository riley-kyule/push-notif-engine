# Phase 3: Browser Push Delivery

## Goal

Deliver queue-backed browser push notifications with worker-based processing and delivery event storage.

## Scope

* Browser push dispatch API
* BullMQ queue creation
* Worker-based push delivery
* VAPID credential storage on sites
* Browser subscription key storage on subscribers
* Delivery event logging
* Delivery acknowledgement callbacks from the service worker back to the API
* Browser service worker foundation
* Local dashboard browser push demo worker for development preview
* Dashboard queue form that proxies dispatch requests to the Nest browser-push endpoint

## API Endpoints

* `POST /api/browser-push/dispatch`

## Database Tables

* `push_delivery_events`

## Database Changes

* `sites` gains VAPID credential columns
* `subscribers` gains browser subscription key columns

## Notes

* Jobs are queued in Redis and processed asynchronously by workers.
* Delivery events are written per subscriber attempt for later analytics and are updated as `pending`, `sent`, `delivered`, `failed`, or `expired`.
* The worker attaches a per-delivery acknowledgement URL to each notification so the service worker can confirm delivery back to the API.
* The dashboard ships with a local preview worker so browser push can be exercised without a live API in development.
* The dashboard dispatch form is a thin authenticated proxy to the API queue endpoint.
