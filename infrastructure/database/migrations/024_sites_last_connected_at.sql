ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS last_connected_at timestamptz NULL;
