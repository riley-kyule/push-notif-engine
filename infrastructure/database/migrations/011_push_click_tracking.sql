-- Track when a subscriber actually clicks a delivered push notification, for real CTR analytics.
ALTER TABLE push_delivery_events
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_push_delivery_events_clicked_at
  ON push_delivery_events(clicked_at)
  WHERE clicked_at IS NOT NULL;
