-- Update the default welcome-push automation's copy. Only touches rows that
-- still hold the exact previous default text, so any admin who already
-- customized their welcome push keeps their own wording untouched.

-- Global ("All Sites") welcome push.
UPDATE automations
SET
  title = 'Subscription Saved',
  message = 'You''ll now get exclusive notifications from {{site_name}}',
  url = '{{site_url}}'
WHERE site_id IS NULL
  AND trigger_event = 'subscriber_registered'
  AND title = 'Welcome to {{site_name}}!'
  AND message = 'Thanks for subscribing - we''ll keep you posted with updates you won''t want to miss.';

-- Per-site welcome push (title previously interpolated the site's own name).
UPDATE automations a
SET
  title = 'Subscription Saved',
  message = 'You''ll now get exclusive notifications from ' || s.name,
  url = s.url
FROM sites s
WHERE a.site_id = s.id
  AND a.trigger_event = 'subscriber_registered'
  AND a.title = 'Welcome to ' || s.name || '!'
  AND a.message = 'Thanks for subscribing - we''ll keep you posted with updates you won''t want to miss.';
