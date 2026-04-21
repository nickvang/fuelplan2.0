-- Add text-based distance and goal_time columns to athlete_races
ALTER TABLE public.athlete_races
  ADD COLUMN IF NOT EXISTS distance TEXT,
  ADD COLUMN IF NOT EXISTS goal_time TEXT;
