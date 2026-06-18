ALTER TABLE sites
ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'Other';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_sites_platform'
  ) THEN
    ALTER TABLE sites
    ADD CONSTRAINT ck_sites_platform CHECK (platform IN ('WordPress', 'Magento', 'Node.js', 'Laravel', 'Other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_sites_platform ON sites(platform);
