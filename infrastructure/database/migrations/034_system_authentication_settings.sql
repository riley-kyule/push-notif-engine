CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('auth.native_sign_in_enabled', 'true'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
