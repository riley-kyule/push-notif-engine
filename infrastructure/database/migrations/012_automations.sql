-- Trigger-based single-subscriber sends (e.g. a welcome push when a subscriber registers).
CREATE TABLE IF NOT EXISTS automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_event text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  url text NOT NULL,
  image_url text NULL,
  icon_url text NULL,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automations_site_id ON automations(site_id);
CREATE INDEX IF NOT EXISTS idx_automations_trigger_event ON automations(trigger_event);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_automations_trigger_event') THEN
    ALTER TABLE automations
      ADD CONSTRAINT ck_automations_trigger_event CHECK (trigger_event IN ('subscriber_registered'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_automations_status') THEN
    ALTER TABLE automations
      ADD CONSTRAINT ck_automations_status CHECK (status IN ('active', 'paused'));
  END IF;
END $$;