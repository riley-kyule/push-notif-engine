ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'announcement';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_campaigns_content_type'
  ) THEN
    ALTER TABLE campaigns
      ADD CONSTRAINT ck_campaigns_content_type
      CHECK (content_type IN ('announcement', 'promotion', 'editorial', 'digest', 'alert'));
  END IF;
END
$$;

UPDATE campaigns
SET content_type = COALESCE(NULLIF(content_type, ''), 'announcement');
