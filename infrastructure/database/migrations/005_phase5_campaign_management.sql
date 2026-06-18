CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel text NOT NULL DEFAULT 'web',
  type text NOT NULL DEFAULT 'instant',
  title text NOT NULL,
  message text NOT NULL,
  url text NOT NULL,
  image_url text NULL,
  icon_url text NULL,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  expiration_at timestamptz NULL,
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz NULL,
  timezone text NULL,
  recurrence_type text NULL,
  recurrence_interval integer NULL,
  recurrence_until_at timestamptz NULL,
  cloned_from_campaign_id uuid NULL REFERENCES campaigns(id) ON DELETE SET NULL,
  sent_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_campaigns_site_name UNIQUE (site_id, name),
  CONSTRAINT ck_campaigns_channel CHECK (channel IN ('web', 'mobile', 'all')),
  CONSTRAINT ck_campaigns_type CHECK (type IN ('instant', 'scheduled', 'recurring')),
  CONSTRAINT ck_campaigns_status CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'expired')),
  CONSTRAINT ck_campaigns_recurrence_type CHECK (
    recurrence_type IS NULL OR recurrence_type IN ('daily', 'weekly', 'monthly')
  )
);

CREATE INDEX IF NOT EXISTS idx_campaigns_site_id ON campaigns(site_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
