ALTER TABLE push_delivery_events
ADD COLUMN IF NOT EXISTS sent_at timestamptz NULL,
ADD COLUMN IF NOT EXISTS delivered_at timestamptz NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_push_delivery_events_status'
  ) THEN
    ALTER TABLE push_delivery_events
      ADD CONSTRAINT ck_push_delivery_events_status
      CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'expired'));
  END IF;
END $$;
