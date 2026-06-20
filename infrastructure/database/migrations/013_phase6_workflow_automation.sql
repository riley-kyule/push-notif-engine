-- Phase 6 workflow foundation: generic automation actions, event logs, subscriber tags, and RSS feed tracking.
ALTER TABLE automations
  ADD COLUMN IF NOT EXISTS actions jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_automations_trigger_event') THEN
    ALTER TABLE automations DROP CONSTRAINT ck_automations_trigger_event;
  END IF;

  ALTER TABLE automations
    ADD CONSTRAINT ck_automations_trigger_event
    CHECK (trigger_event IN ('subscriber_registered', 'page_visit', 'click', 'api_event', 'rss_item_published'));
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_automations_status') THEN
    ALTER TABLE automations DROP CONSTRAINT ck_automations_status;
  END IF;

  ALTER TABLE automations
    ADD CONSTRAINT ck_automations_status
    CHECK (status IN ('active', 'paused'));
END $$;

CREATE TABLE IF NOT EXISTS automation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  subscriber_id uuid NULL REFERENCES subscribers(id) ON DELETE SET NULL,
  campaign_id uuid NULL REFERENCES campaigns(id) ON DELETE SET NULL,
  trigger_event text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text NULL,
  executed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_automation_events_status CHECK (status IN ('pending', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_automation_events_site_id ON automation_events(site_id);
CREATE INDEX IF NOT EXISTS idx_automation_events_trigger_event ON automation_events(trigger_event);
CREATE INDEX IF NOT EXISTS idx_automation_events_status ON automation_events(status);
CREATE INDEX IF NOT EXISTS idx_automation_events_created_at ON automation_events(created_at DESC);

CREATE TABLE IF NOT EXISTS subscriber_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
  tag text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_subscriber_tags_subscriber_tag UNIQUE (subscriber_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_subscriber_tags_subscriber_id ON subscriber_tags(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_tags_tag ON subscriber_tags(tag);

CREATE TABLE IF NOT EXISTS rss_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  feed_url text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_item_guid text NULL,
  last_item_title text NULL,
  last_item_url text NULL,
  last_item_published_at timestamptz NULL,
  last_polled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_rss_feeds_site_name UNIQUE (site_id, name),
  CONSTRAINT uq_rss_feeds_site_url UNIQUE (site_id, feed_url),
  CONSTRAINT ck_rss_feeds_status CHECK (status IN ('active', 'paused'))
);

CREATE INDEX IF NOT EXISTS idx_rss_feeds_site_id ON rss_feeds(site_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_status ON rss_feeds(status);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_last_polled_at ON rss_feeds(last_polled_at DESC);
