-- Attributes a delivery to the automation that triggered it, alongside the
-- existing campaign_id. Both null means an ad-hoc/manual dispatch. This is
-- what lets the failures report show "which push" failed (campaign name,
-- automation name, or manual) instead of just a site and an error code.
ALTER TABLE push_delivery_events
  ADD COLUMN IF NOT EXISTS automation_id uuid NULL REFERENCES automations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_push_delivery_events_automation_id
  ON push_delivery_events(automation_id)
  WHERE automation_id IS NOT NULL;
