ALTER TABLE public.hydration_profiles
  ADD COLUMN IF NOT EXISTS health_consent_given BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS algorithm_consent_given BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_version TEXT;

COMMENT ON COLUMN public.hydration_profiles.health_consent_given IS 'Explicit Art. 9(2)(a) consent for health data processing. Added 2026-04-15.';
COMMENT ON COLUMN public.hydration_profiles.algorithm_consent_given IS 'Optional consent for anonymised data to be used for algorithm improvement. Added 2026-04-15.';
COMMENT ON COLUMN public.hydration_profiles.consent_version IS 'Version string of the consent text shown to the user at the time of consent, e.g. v2-2026-04.';
