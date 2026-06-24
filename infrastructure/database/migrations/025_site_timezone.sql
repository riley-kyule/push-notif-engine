-- Server-computed from the site's country (see services/api/src/sites/country-timezone.data.ts).
-- Nullable: existing sites created before this feature won't have one until re-saved
-- through the new country dropdown, which recomputes it.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS timezone text NULL;
