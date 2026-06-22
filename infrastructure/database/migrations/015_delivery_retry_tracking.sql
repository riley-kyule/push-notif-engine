-- Tracks BullMQ job identity and attempt history on delivery events so that:
--  1) stalled/retried jobs (worker crash mid-job, BullMQ-level retry) can skip
--     recipients already marked sent/delivered for the same job, avoiding duplicate sends
--  2) retry attempts and timing are visible for debugging delivery reliability
ALTER TABLE push_delivery_events
ADD COLUMN IF NOT EXISTS job_id text NULL,
ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_push_delivery_events_job_id ON push_delivery_events(job_id);

ALTER TABLE mobile_push_events
ADD COLUMN IF NOT EXISTS job_id text NULL,
ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_attempted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_mobile_push_events_job_id ON mobile_push_events(job_id);
