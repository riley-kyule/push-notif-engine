ALTER TABLE sites
ADD COLUMN IF NOT EXISTS vapid_subject text NULL,
ADD COLUMN IF NOT EXISTS vapid_public_key text NULL,
ADD COLUMN IF NOT EXISTS vapid_private_key text NULL;

ALTER TABLE subscribers
ADD COLUMN IF NOT EXISTS p256dh_key text NULL,
ADD COLUMN IF NOT EXISTS auth_key text NULL;

CREATE TABLE IF NOT EXISTS push_delivery_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  subscriber_id uuid NULL REFERENCES subscribers(id) ON DELETE SET NULL,
  endpoint text NOT NULL,
  status text NOT NULL,
  provider_message_id text NULL,
  error_code text NULL,
  error_message text NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_events_site_id ON push_delivery_events(site_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_events_subscriber_id ON push_delivery_events(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_events_status ON push_delivery_events(status);
