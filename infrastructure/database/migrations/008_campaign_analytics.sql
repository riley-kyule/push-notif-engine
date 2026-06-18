-- Phase 8: link delivery events to campaigns
ALTER TABLE push_delivery_events
  ADD COLUMN IF NOT EXISTS campaign_id uuid NULL REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_push_delivery_events_campaign_id
  ON push_delivery_events(campaign_id)
  WHERE campaign_id IS NOT NULL;
