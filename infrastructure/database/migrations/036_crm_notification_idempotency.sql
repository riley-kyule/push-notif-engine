ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS external_idempotency_key text NULL;

ALTER TABLE campaigns
DROP CONSTRAINT IF EXISTS uq_campaigns_site_name;

CREATE UNIQUE INDEX IF NOT EXISTS uq_campaigns_site_external_idempotency_key
ON campaigns (site_id, external_idempotency_key)
WHERE external_idempotency_key IS NOT NULL;
