-- Add deletion_token column to hydration_profiles for secure data deletion
ALTER TABLE public.hydration_profiles 
ADD COLUMN deletion_token UUID DEFAULT gen_random_uuid();

-- Create unique index on deletion_token for fast lookups
CREATE UNIQUE INDEX idx_hydration_profiles_deletion_token 
ON public.hydration_profiles(deletion_token);