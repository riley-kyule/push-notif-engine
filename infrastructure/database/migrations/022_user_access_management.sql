ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO roles (slug, name, permissions)
VALUES
  (
    'sub-admin',
    'Sub-Admin',
    '["sites:manage","sites:settings","analytics:view","subscribers:view","campaigns:manage","campaign-taxonomies:manage","segments:manage"]'::jsonb
  ),
  (
    'customer-service',
    'Customer Service',
    '["campaigns:assigned"]'::jsonb
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  permissions = EXCLUDED.permissions,
  updated_at = NOW();

UPDATE roles
SET permissions = '["users:manage","roles:manage","automations:manage","sites:manage","sites:settings","analytics:view","subscribers:view","campaigns:manage","campaigns:assigned","campaign-taxonomies:manage","segments:manage","audit-logs:view","system-health:view","backups:manage"]'::jsonb,
    updated_at = NOW()
WHERE slug = 'super-admin';

UPDATE roles
SET permissions = '["users:manage","automations:manage","sites:manage","sites:settings","analytics:view","subscribers:view","campaigns:manage","campaigns:assigned","campaign-taxonomies:manage","segments:manage","audit-logs:view","system-health:view","backups:manage"]'::jsonb,
    updated_at = NOW()
WHERE slug = 'admin';

UPDATE roles
SET permissions = '["sites:manage","sites:settings","analytics:view","subscribers:view","campaigns:manage","campaign-taxonomies:manage","segments:manage"]'::jsonb,
    updated_at = NOW()
WHERE slug IN ('sub-admin', 'editor');

UPDATE roles
SET permissions = '["campaigns:assigned"]'::jsonb,
    updated_at = NOW()
WHERE slug IN ('customer-service', 'analyst');
