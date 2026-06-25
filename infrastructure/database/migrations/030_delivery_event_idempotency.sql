-- A BullMQ-retried job (worker crash mid-job, or job-level retry after the
-- stalled-job detector reclaims it) re-runs createPendingDeliveryEvents for
-- the same job_id/subscriber pairs. Without a uniqueness guarantee, every
-- retry inserted a brand new pending row per recipient instead of reusing
-- the one from the previous attempt -- on a large send (hundreds of
-- thousands of recipients) a single restart mid-job could multiply pending
-- rows and, worse, queue a second real push send to recipients the first
-- attempt had already reached. The partial unique index (job_id IS NOT NULL,
-- so one-off sends with no job_id are unaffected) lets the INSERT use
-- ON CONFLICT to reuse the existing row instead.
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_delivery_events_job_subscriber
  ON push_delivery_events (job_id, subscriber_id)
  WHERE job_id IS NOT NULL AND subscriber_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_mobile_push_events_job_device
  ON mobile_push_events (job_id, mobile_device_id)
  WHERE job_id IS NOT NULL AND mobile_device_id IS NOT NULL;
