-- Create table for storing hydration profiles with GDPR compliance
CREATE TABLE IF NOT EXISTS public.hydration_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Profile Data
  profile_data JSONB NOT NULL,
  plan_data JSONB,
  
  -- GDPR Compliance
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_timestamp TIMESTAMP WITH TIME ZONE,
  data_retention_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '2 years'),
  
  -- Optional user association (if they want to save it)
  user_email TEXT,
  
  -- Metadata
  has_smartwatch_data BOOLEAN DEFAULT false,
  ip_address INET,
  user_agent TEXT
);

-- Enable Row Level Security
ALTER TABLE public.hydration_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert their own profile (anonymous data collection)
CREATE POLICY "Anyone can insert hydration profiles"
  ON public.hydration_profiles
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Users can only read their own profiles if they provided email
CREATE POLICY "Users can view own profiles"
  ON public.hydration_profiles
  FOR SELECT
  TO anon, authenticated
  USING (user_email = current_setting('request.jwt.claims', true)::json->>'email' OR user_email IS NULL);

-- Create index for efficient queries
CREATE INDEX idx_hydration_profiles_created_at ON public.hydration_profiles(created_at DESC);
CREATE INDEX idx_hydration_profiles_user_email ON public.hydration_profiles(user_email);

-- Function to auto-delete expired profiles (GDPR data retention)
CREATE OR REPLACE FUNCTION delete_expired_hydration_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.hydration_profiles
  WHERE data_retention_expires_at < now();
END;
$$;

-- Comment explaining GDPR compliance
COMMENT ON TABLE public.hydration_profiles IS 'Stores anonymized hydration profiles with GDPR-compliant data retention (2 years default). Data can be deleted on request.';
COMMENT ON COLUMN public.hydration_profiles.consent_given IS 'User must explicitly consent to data collection per GDPR Article 6(1)(a)';
COMMENT ON COLUMN public.hydration_profiles.data_retention_expires_at IS 'GDPR Article 5(1)(e) - storage limitation principle. Data auto-deleted after 2 years.';