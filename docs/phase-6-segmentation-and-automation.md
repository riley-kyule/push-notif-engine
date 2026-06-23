# Phase 6: Segmentation and Automation

## Goal

Support dynamic audience targeting and event-driven workflows.

## Scope

* Segment CRUD
* Segment rule builder support
* Live reach estimation
* Dynamic rule evaluation against subscriber data
* Segment-targeted campaign delivery
* Automation CRUD (independent of the workflow event/RSS surface)
* Generic workflow automation triggers
* Workflow action execution
* RSS feed automation foundation
* Subscriber tag automation
* Workflow event logging
* Dashboard workflow console for RSS feed management, event recording, and execution visibility

## Segment Model

Segments are site-scoped and stored as a rule definition composed of:

* `matchMode` - `all` or `any`
* `rules` - ordered rule array

Supported fields:

* `country`
* `browser`
* `deviceType`
* `language`
* `status`
* `lastSeenAt`

Supported operators:

* `is`
* `isNot`
* `in`
* `notIn`
* `withinDays`
* `olderThanDays`

## Segment-Targeted Campaigns

Campaigns may target a segment instead of every active subscriber on the site.

* `campaigns.segment_id` references `segments(id)` and is nullable; a null value means "all active subscribers."
* The API validates that the referenced segment belongs to the same site as the campaign before create/update.
* At delivery time, the segment's rule definition is compiled into a SQL filter clause and applied against the subscriber table, so targeting is evaluated fresh on each send rather than against a cached audience snapshot.

## Automation Model

Automations are site-scoped, trigger-driven records with full CRUD, managed independently of the workflow event/RSS surface described below.

Supported triggers:

* `subscriber_registered`
* `page_visit`
* `click`
* `api_event`
* `rss_item_published`

Supported actions:

* `send_notification`
* `add_tag`
* `remove_tag`
* `webhook`

Notes:

* If no explicit actions are stored, the automation falls back to a single `send_notification` action built from the notification template fields.
* `send_notification` actions fan out through the browser push queue.
* `add_tag` and `remove_tag` persist tag state against the subscriber, recorded in `subscriber_tags`.
* `webhook` actions POST, PUT, or PATCH a JSON payload from the workflow engine.
* Every workflow execution is written to the `automation_events` table, including `pending`/`completed`/`failed` status and error message on failure.

## RSS Automation Model

RSS feeds are stored per site and polled on a schedule.

RSS feed fields:

* `name`
* `feedUrl`
* `status`
* `lastItemGuid`
* `lastItemTitle`
* `lastItemUrl`
* `lastItemPublishedAt`
* `lastPolledAt`

RSS polling behavior:

* A cron job (`*/15 * * * *`) polls every active feed automatically; `POST /workflow/rss-feeds/:id/poll` also allows an on-demand poll from the dashboard.
* Detect the latest item by GUID or URL.
* Ignore unchanged feeds.
* Emit a `rss_item_published` workflow event when a new item appears.
* Poll failures are logged per-feed and do not stop the rest of the batch from polling.

## API Endpoints

Segments:

* `POST /segments`
* `GET /segments`
* `GET /segments/:id`
* `PATCH /segments/:id`
* `DELETE /segments/:id`
* `POST /segments/estimate`
* `GET /segments/:id/estimate`

Automations:

* `POST /automations`
* `GET /automations`
* `GET /automations/:id`
* `PATCH /automations/:id`
* `DELETE /automations/:id`

Workflow events and RSS feeds:

* `POST /workflow/events`
* `GET /workflow/events`
* `GET /workflow/rss-feeds`
* `POST /workflow/rss-feeds`
* `GET /workflow/rss-feeds/:id`
* `PATCH /workflow/rss-feeds/:id`
* `DELETE /workflow/rss-feeds/:id`
* `POST /workflow/rss-feeds/:id/poll`

## Database Tables

* `segments` - segment definitions (`006_phase6_segments.sql`)
* `automations` - automation CRUD records (`012_automations.sql`)
* `automation_events` - workflow execution log (`013_phase6_workflow_automation.sql`)
* `subscriber_tags` - tag state from `add_tag`/`remove_tag` actions (`013_phase6_workflow_automation.sql`)
* `rss_feeds` - per-site RSS feed configuration and poll state (`013_phase6_workflow_automation.sql`)
* `campaigns.segment_id` - nullable FK added by `010_segment_targeted_campaigns.sql` to support segment-targeted sends

## Notes

* Segment reach estimation is computed from subscriber data.
* Invalid rules are rejected before persistence.
* RSS automation and workflow automation now build on the segment foundation.
* The workflow engine intentionally keeps push delivery on the browser-push queue instead of sending directly from the API request.
* The dashboard exposes the workflow control surface so operators can create RSS feeds, record events, and inspect automation health without leaving the UI.
* Automations are managed through their own CRUD resource (`/automations`); `/workflow/events` is the separate surface used to record and inspect trigger events and their execution outcome.
* Segments double as both audience filters (estimate/reporting) and campaign targeting (`campaigns.segment_id`) — the same rule definition and SQL compiler back both use cases.
* The dashboard now includes `/segments` for audience targeting review, `/automations` for rule review, and `/workflow` for RSS/event operations.
