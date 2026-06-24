-- The global ("All Sites") welcome push seeded by seedGlobalDefaultAutomations
-- used to hardcode a literal "https://example.com" destination and a generic
-- title, instead of resolving per-site at send time. Application code now
-- supports {{site_name}} / {{site_url}} tokens in an automation's title,
-- message, and url, resolved against the real site a subscriber belongs to
-- when the automation actually fires. Repoint any already-seeded global
-- welcome push that still has the old hardcoded placeholder values so it
-- becomes dynamic without the user needing to recreate it.
UPDATE automations
SET
  title = 'Welcome to {{site_name}}!',
  url = '{{site_url}}'
WHERE site_id IS NULL
  AND trigger_event = 'subscriber_registered'
  AND url = 'https://example.com';
