-- ============================================================
-- Migration: Athlete races calendar
-- ============================================================

CREATE TABLE public.athlete_races (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  race_name TEXT NOT NULL,
  race_date DATE NOT NULL,
  distance_km NUMERIC,
  discipline TEXT,
  location_city TEXT,
  location_country TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  plan_id UUID REFERENCES public.hydration_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.athlete_races ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own races"
  ON public.athlete_races
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_athlete_races_user_id ON public.athlete_races(user_id);
CREATE INDEX idx_athlete_races_race_date ON public.athlete_races(race_date);
