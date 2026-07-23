CREATE TABLE IF NOT EXISTS notification_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  callback_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'delivered', 'exhausted')),
  attempt_count integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT NOW(),
  last_attempted_at timestamptz NULL,
  delivered_at timestamptz NULL,
  last_http_status integer NULL,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_callbacks_due
  ON notification_callbacks (next_attempt_at ASC)
  WHERE status IN ('pending', 'retrying');
