ALTER TABLE sites
  ADD COLUMN IF NOT EXISTS rest_api_key_id text NULL,
  ADD COLUMN IF NOT EXISTS rest_api_auth_token_hash text NULL,
  ADD COLUMN IF NOT EXISTS rest_api_auth_token_last4 text NULL,
  ADD COLUMN IF NOT EXISTS rest_api_credentials_generated_at timestamptz NULL;
