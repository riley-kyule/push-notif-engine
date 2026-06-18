CREATE TABLE IF NOT EXISTS mobile_push_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
  apns_key_id text NULL,
  apns_team_id text NULL,
  apns_bundle_id text NULL,
  apns_private_key text NULL,
  fcm_project_id text NULL,
  fcm_client_email text NULL,
  fcm_private_key text NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_credentials_site_id ON mobile_push_credentials(site_id);

CREATE TABLE IF NOT EXISTS mobile_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  platform text NOT NULL,
  device_token text NOT NULL,
  country text NULL,
  language text NULL,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_mobile_devices_site_platform_token UNIQUE (site_id, platform, device_token)
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_site_id ON mobile_devices(site_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_platform ON mobile_devices(platform);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_status ON mobile_devices(status);

CREATE TABLE IF NOT EXISTS mobile_push_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  mobile_device_id uuid NULL REFERENCES mobile_devices(id) ON DELETE SET NULL,
  platform text NOT NULL,
  device_token text NOT NULL,
  status text NOT NULL,
  provider_message_id text NULL,
  error_code text NULL,
  error_message text NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_events_site_id ON mobile_push_events(site_id);
CREATE INDEX IF NOT EXISTS idx_mobile_push_events_device_id ON mobile_push_events(mobile_device_id);
CREATE INDEX IF NOT EXISTS idx_mobile_push_events_status ON mobile_push_events(status);

CREATE TABLE IF NOT EXISTS mobile_push_click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  mobile_device_id uuid NULL REFERENCES mobile_devices(id) ON DELETE SET NULL,
  platform text NOT NULL,
  device_token text NOT NULL,
  destination_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_push_click_events_site_id ON mobile_push_click_events(site_id);
CREATE INDEX IF NOT EXISTS idx_mobile_push_click_events_device_id ON mobile_push_click_events(mobile_device_id);
CREATE INDEX IF NOT EXISTS idx_mobile_push_click_events_platform ON mobile_push_click_events(platform);
