ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS ab_variants jsonb NOT NULL DEFAULT '[]'::jsonb;
