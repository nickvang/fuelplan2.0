-- Add deletion_token to garmin_connections for GDPR Article 17 erasure requests.
-- RLS and service-role-only policies already exist (see 20260320000000_garmin_rls.sql).
ALTER TABLE garmin_connections
  ADD COLUMN deletion_token UUID UNIQUE DEFAULT gen_random_uuid();
