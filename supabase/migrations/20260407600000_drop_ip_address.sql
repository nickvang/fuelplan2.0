-- Drop raw IP address column from hydration_profiles.
-- We don't use it for anything and storing it is a GDPR liability.
ALTER TABLE hydration_profiles DROP COLUMN IF EXISTS ip_address;
