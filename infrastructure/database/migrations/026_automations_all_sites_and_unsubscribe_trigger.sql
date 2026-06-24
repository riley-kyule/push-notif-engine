-- subscriber_unsubscribed was added in application code in a previous change
-- but this CHECK constraint was never widened to match -- any automation on
-- that trigger fails at insert time until this runs.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_automations_trigger_event') THEN
    ALTER TABLE automations DROP CONSTRAINT ck_automations_trigger_event;
  END IF;

  ALTER TABLE automations
    ADD CONSTRAINT ck_automations_trigger_event
    CHECK (trigger_event IN ('subscriber_registered', 'subscriber_unsubscribed', 'page_visit', 'click', 'api_event', 'rss_item_published'));
END $$;

-- Nullable site_id means "applies to every site" (including ones created
-- later) -- evaluated alongside that site's own automations rather than
-- duplicated into a separate row per site.
ALTER TABLE automations ALTER COLUMN site_id DROP NOT NULL;
