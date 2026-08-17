ALTER TABLE sites
ADD COLUMN IF NOT EXISTS opt_in_prompt_display_mode text NOT NULL DEFAULT 'immediate',
ADD COLUMN IF NOT EXISTS opt_in_prompt_scroll_percent integer NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS opt_in_prompt_page_view_count integer NOT NULL DEFAULT 3;

ALTER TABLE sites
DROP CONSTRAINT IF EXISTS sites_opt_in_prompt_display_mode_check,
DROP CONSTRAINT IF EXISTS sites_opt_in_prompt_scroll_percent_check,
DROP CONSTRAINT IF EXISTS sites_opt_in_prompt_page_view_count_check;

ALTER TABLE sites
ADD CONSTRAINT sites_opt_in_prompt_display_mode_check
  CHECK (opt_in_prompt_display_mode IN ('immediate', 'scroll', 'page-views')),
ADD CONSTRAINT sites_opt_in_prompt_scroll_percent_check
  CHECK (opt_in_prompt_scroll_percent BETWEEN 1 AND 100),
ADD CONSTRAINT sites_opt_in_prompt_page_view_count_check
  CHECK (opt_in_prompt_page_view_count BETWEEN 1 AND 100);
