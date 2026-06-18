-- Allow campaigns to target a specific segment instead of every active subscriber on the site.
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS segment_id uuid NULL REFERENCES segments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_segment_id
  ON campaigns(segment_id)
  WHERE segment_id IS NOT NULL;
