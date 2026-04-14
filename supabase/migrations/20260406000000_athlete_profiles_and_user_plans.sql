-- ============================================================
-- Migration: Athlete profiles + link plans to users
-- ============================================================

-- 1. Create athlete_profiles table
CREATE TABLE public.athlete_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  age INTEGER,
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  height NUMERIC,
  weight NUMERIC,
  body_fat NUMERIC,
  resting_heart_rate INTEGER,
  hrv TEXT,
  sleep_hours NUMERIC,
  sleep_quality INTEGER,
  sweat_rate TEXT DEFAULT 'medium' CHECK (sweat_rate IN ('low', 'medium', 'high')),
  sweat_saltiness TEXT DEFAULT 'medium' CHECK (sweat_saltiness IN ('low', 'medium', 'high')),
  known_sodium_loss NUMERIC,
  strava_connected BOOLEAN DEFAULT false,
  strava_refresh_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own athlete profile"
  ON public.athlete_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own athlete profile"
  ON public.athlete_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own athlete profile"
  ON public.athlete_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all athlete profiles"
  ON public.athlete_profiles FOR SELECT TO authenticated
  USING (public.is_admin());

-- 2. Add user_id to hydration_profiles
ALTER TABLE public.hydration_profiles
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_hydration_profiles_user_id ON public.hydration_profiles(user_id);

CREATE POLICY "Users can read own hydration profiles"
  ON public.hydration_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3. Extend handle_new_user trigger to also create athlete_profiles row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );

  INSERT INTO public.athlete_profiles (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;
