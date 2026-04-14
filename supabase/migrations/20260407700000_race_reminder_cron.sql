-- Schedule race reminder emails: morning (07:00 UTC) and evening (19:00 UTC)
-- Requires pg_cron and pg_net extensions (enabled by default on Supabase).

SELECT cron.schedule(
  'send-race-reminders-morning',
  '0 7 * * *',
  $$SELECT net.http_post(
    'https://{project_ref}.supabase.co/functions/v1/send-race-reminders',
    '{}',
    'application/json',
    ARRAY[http_header('Authorization', 'Bearer ' || current_setting('supabase.service_role_key'))]
  )$$
);

SELECT cron.schedule(
  'send-race-reminders-evening',
  '0 19 * * *',
  $$SELECT net.http_post(
    'https://{project_ref}.supabase.co/functions/v1/send-race-reminders',
    '{"evening_run": true}',
    'application/json',
    ARRAY[http_header('Authorization', 'Bearer ' || current_setting('supabase.service_role_key'))]
  )$$
);
