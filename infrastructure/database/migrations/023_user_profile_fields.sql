ALTER TABLE users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS username text;

UPDATE users
SET
  first_name = COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1)),
  last_name = COALESCE(
    NULLIF(last_name, ''),
    CASE
      WHEN position(' ' IN name) > 0 THEN substr(name, position(' ' IN name) + 1)
      ELSE ''
    END
  ),
  username = COALESCE(
    NULLIF(username, ''),
    lower(regexp_replace(split_part(name, ' ', 1), '[^a-zA-Z0-9]+', '', 'g'))
  )
WHERE first_name IS NULL
   OR last_name IS NULL
   OR username IS NULL;

UPDATE users
SET
  first_name = COALESCE(NULLIF(first_name, ''), 'Unknown'),
  last_name = COALESCE(NULLIF(last_name, ''), ''),
  username = COALESCE(NULLIF(username, ''), lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9]+', '', 'g')))
WHERE first_name IS NULL
   OR last_name IS NULL
   OR username IS NULL;

ALTER TABLE users
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
