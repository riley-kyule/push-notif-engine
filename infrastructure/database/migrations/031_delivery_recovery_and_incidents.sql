ALTER TABLE push_delivery_events
  ADD COLUMN IF NOT EXISTS retried_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS retry_job_id text NULL,
  ADD COLUMN IF NOT EXISTS retry_source_event_id uuid NULL REFERENCES push_delivery_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_push_delivery_events_retryable
  ON push_delivery_events (created_at DESC)
  WHERE status = 'failed' AND retried_at IS NULL;

CREATE TABLE IF NOT EXISTS push_delivery_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('browser', 'mobile')),
  provider text NOT NULL,
  job_id text NOT NULL,
  site_id uuid NULL REFERENCES sites(id) ON DELETE SET NULL,
  campaign_id uuid NULL REFERENCES campaigns(id) ON DELETE SET NULL,
  error_code text NOT NULL,
  error_message text NOT NULL,
  failure_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'recovered', 'exhausted')),
  first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  recovered_at timestamptz NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (channel, provider, job_id, error_code)
);

CREATE INDEX IF NOT EXISTS idx_push_delivery_incidents_recent
  ON push_delivery_incidents (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_delivery_incidents_open
  ON push_delivery_incidents (status, last_seen_at DESC)
  WHERE status = 'open';
