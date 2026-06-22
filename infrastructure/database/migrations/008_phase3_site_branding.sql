ALTER TABLE sites
ADD COLUMN IF NOT EXISTS app_name text NULL,
ADD COLUMN IF NOT EXISTS icon_url text NULL,
ADD COLUMN IF NOT EXISTS theme_color text NULL;

UPDATE sites
SET app_name = COALESCE(NULLIF(app_name, ''), name),
    theme_color = COALESCE(NULLIF(theme_color, ''), '#1c1917')
WHERE app_name IS NULL
   OR app_name = ''
   OR theme_color IS NULL
   OR theme_color = '';
