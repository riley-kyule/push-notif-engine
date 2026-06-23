# Phase 2: Core Data Management

## Goal

Provide the core entities for Exotic website management and subscriber capture.

## Scope

* Site CRUD
* Site listing and filtering
* Subscriber registration
* Subscriber listing and filtering
* Subscriber status updates
* Dashboard site management pages
* Dashboard subscriber collection pages
* Per-site platform type

## API Endpoints

* `POST /api/sites`
* `GET /api/sites`
* `GET /api/sites/:id`
* `PATCH /api/sites/:id`
* `POST /api/subscribers/register`
* `GET /api/subscribers`
* `GET /api/subscribers/:id`
* `PATCH /api/subscribers/:id/status`
* `GET /api/dashboard/sites`
* `GET /api/dashboard/sites/:id`
* `GET /api/dashboard/subscribers`
* `GET /api/dashboard/subscribers/:id`

## Database Tables

* `sites`
* `subscribers`

## Notes

* Subscriber records are scoped to a site.
* Site and subscriber listing use indexed filters for scale.
* Subscriber registrations are upserts by `site_id` and `subscription_endpoint`.
* Site records include a platform type field: WordPress, Magento, Node.js, Laravel, or Other.
* Dashboard routes fall back to local data for development so the UI can run without a live API.
