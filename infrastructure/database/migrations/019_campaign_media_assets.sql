CREATE TABLE IF NOT EXISTS campaign_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  campaign_id uuid NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  kind text NOT NULL,
  original_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_campaign_media_assets_kind CHECK (kind IN ('image', 'icon')),
  CONSTRAINT ck_campaign_media_assets_size_bytes CHECK (size_bytes > 0)
);

CREATE INDEX IF NOT EXISTS idx_campaign_media_assets_site_id ON campaign_media_assets(site_id);
CREATE INDEX IF NOT EXISTS idx_campaign_media_assets_campaign_id ON campaign_media_assets(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_media_assets_kind ON campaign_media_assets(kind);
CREATE INDEX IF NOT EXISTS idx_campaign_media_assets_created_at ON campaign_media_assets(created_at DESC);
