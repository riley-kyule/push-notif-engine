CREATE TABLE IF NOT EXISTS sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  country text NOT NULL,
  language text NOT NULL,
  logo_url text NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status);
CREATE INDEX IF NOT EXISTS idx_sites_country ON sites(country);
CREATE INDEX IF NOT EXISTS idx_sites_language ON sites(language);
CREATE INDEX IF NOT EXISTS idx_sites_name_lower ON sites (LOWER(name));

CREATE TABLE IF NOT EXISTS subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  browser text NOT NULL,
  device_type text NOT NULL,
  country text NOT NULL,
  language text NOT NULL,
  subscription_endpoint text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_subscribers_site_endpoint UNIQUE (site_id, subscription_endpoint)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_site_id ON subscribers(site_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_browser ON subscribers(browser);
CREATE INDEX IF NOT EXISTS idx_subscribers_device_type ON subscribers(device_type);
CREATE INDEX IF NOT EXISTS idx_subscribers_country ON subscribers(country);
CREATE INDEX IF NOT EXISTS idx_subscribers_language ON subscribers(language);
CREATE INDEX IF NOT EXISTS idx_subscribers_last_seen_at ON subscribers(last_seen_at);
