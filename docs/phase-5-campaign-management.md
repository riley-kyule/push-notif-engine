# Phase 5: Campaign Management

## Goal

Provide campaign CRUD and scheduling primitives for Exotic push operations.

## Scope

* Campaign creation
* Campaign listing and filtering
* Campaign detail retrieval
* Campaign updates
* Campaign deletion
* Campaign cloning
* Campaign preview data
* Campaign scheduling metadata
* Draft support

## API Endpoints

* `GET /api/campaigns`
* `POST /api/campaigns`
* `GET /api/campaigns/:id`
* `PATCH /api/campaigns/:id`
* `DELETE /api/campaigns/:id`
* `POST /api/campaigns/:id/clone`
* `POST /api/campaigns/:id/preview`
* `POST /api/campaigns/:id/schedule`

## Database Tables

* `campaigns`

## Notes

* Campaigns are scoped to a single Exotic site.
* Drafts are the default creation state.
* Scheduling data is persisted with the campaign record so later delivery workers can consume it without schema churn.
* Campaign content includes title, message, URL, image, icon, buttons, and expiration metadata.
