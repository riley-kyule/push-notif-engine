ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS google_subject text NULL,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz NULL;

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_subject
  ON users(google_subject)
  WHERE google_subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users(auth_provider);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users(last_login_at);
