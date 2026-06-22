CREATE TABLE IF NOT EXISTS backup_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE CHECK (provider IN ('dropbox', 'google_drive')),
  account_label text NULL,
  encrypted_refresh_token text NOT NULL,
  access_token text NULL,
  access_token_expires_at timestamptz NULL,
  auto_backup_enabled boolean NOT NULL DEFAULT false,
  frequency text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  next_backup_due_at timestamptz NULL,
  connected_by_user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('dropbox', 'google_drive')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  trigger text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'scheduled')),
  file_name text NULL,
  size_bytes bigint NULL,
  error_message text NULL,
  started_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_started_at ON backup_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_runs_provider ON backup_runs(provider);
