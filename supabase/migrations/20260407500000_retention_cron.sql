-- Schedule automatic deletion of expired hydration profiles (GDPR storage limitation).
-- The function delete_expired_hydration_profiles() is defined in an earlier migration.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'delete-expired-hydration-profiles',
  '0 3 * * *',
  $$SELECT delete_expired_hydration_profiles()$$
);

-- NOTE: After running this migration, verify in the Supabase Dashboard
-- (Database → Cron Jobs) that the "delete-expired-hydration-profiles" schedule appears.
