ALTER TABLE public.hydration_profiles ALTER COLUMN ip_address TYPE TEXT;
COMMENT ON COLUMN public.hydration_profiles.ip_address IS 'One-way pseudonymised derivative of client IP (SHA-256 with server salt, first 24 chars). Not reversible. Updated 2026-04-15.';
