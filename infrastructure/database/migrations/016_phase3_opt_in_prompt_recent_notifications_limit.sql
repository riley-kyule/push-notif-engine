ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS opt_in_prompt_recent_notifications_limit integer NOT NULL DEFAULT 3;

UPDATE sites
SET opt_in_prompt_recent_notifications_limit = COALESCE(opt_in_prompt_recent_notifications_limit, 3);
