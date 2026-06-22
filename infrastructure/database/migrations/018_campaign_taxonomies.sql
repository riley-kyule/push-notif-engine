ALTER TABLE campaigns
  DROP CONSTRAINT IF EXISTS ck_campaigns_content_type;

CREATE TABLE IF NOT EXISTS campaign_taxonomies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_taxonomies_is_active ON campaign_taxonomies(is_active);
CREATE INDEX IF NOT EXISTS idx_campaign_taxonomies_sort_order ON campaign_taxonomies(sort_order);

INSERT INTO campaign_taxonomies (slug, label, description, is_active, sort_order)
VALUES
  ('announcement', 'Announcement', 'General product, brand, or site updates.', true, 10),
  ('promotion', 'Promotion', 'Commercial offers and conversion-driven messages.', true, 20),
  ('editorial', 'Editorial', 'Story-led or content-led updates.', true, 30),
  ('digest', 'Digest', 'Roundups and summaries of recent updates.', true, 40),
  ('alert', 'Alert', 'Urgent or time-sensitive notices.', true, 50)
ON CONFLICT (slug) DO UPDATE
SET label = EXCLUDED.label,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();
