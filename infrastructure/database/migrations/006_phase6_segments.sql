CREATE TABLE IF NOT EXISTS segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  match_mode text NOT NULL DEFAULT 'all',
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_segments_site_name UNIQUE (site_id, name),
  CONSTRAINT ck_segments_match_mode CHECK (match_mode IN ('all', 'any')),
  CONSTRAINT ck_segments_status CHECK (status IN ('active', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_segments_site_id ON segments(site_id);
CREATE INDEX IF NOT EXISTS idx_segments_status ON segments(status);
CREATE INDEX IF NOT EXISTS idx_segments_match_mode ON segments(match_mode);
CREATE INDEX IF NOT EXISTS idx_segments_created_at ON segments(created_at DESC);
