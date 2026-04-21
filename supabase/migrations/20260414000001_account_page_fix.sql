-- ============================================================
-- Migration: Account page fixes
-- ============================================================

-- 1. athlete_profiles table for persistent body data (idempotent)
-- Table already exists with user_id FK pattern — this is a no-op if present.
CREATE TABLE IF NOT EXISTS public.athlete_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  age INTEGER,
  sex TEXT CHECK (sex IN ('male', 'female')),
  weight NUMERIC(5,1),
  height NUMERIC(5,1),
  body_fat NUMERIC(4,1),
  resting_heart_rate INTEGER,
  hrv NUMERIC(5,1),
  sleep_hours NUMERIC(3,1),
  sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 10),
  strava_connected BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own athlete profile" ON public.athlete_profiles;
CREATE POLICY "Users manage own athlete profile"
  ON public.athlete_profiles FOR ALL TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 2. athlete_races table (idempotent)
CREATE TABLE IF NOT EXISTS public.athlete_races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  race_name TEXT NOT NULL,
  race_date DATE,
  discipline TEXT,
  distance TEXT,
  goal_time TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.athlete_races ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own races" ON public.athlete_races;
CREATE POLICY "Users manage own races"
  ON public.athlete_races FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3. Add auth_user_id to hydration_profiles for plan history lookup
ALTER TABLE public.hydration_profiles
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_hydration_profiles_auth_user
  ON public.hydration_profiles(auth_user_id);
