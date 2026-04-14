-- ============================================================
-- Migration: Post-race feedback
-- ============================================================

CREATE TABLE public.race_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  race_id UUID REFERENCES public.athlete_races(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.hydration_profiles(id) ON DELETE SET NULL,
  overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
  issues TEXT[] DEFAULT '{}',
  water_feedback TEXT CHECK (water_feedback IN ('too_much', 'just_right', 'too_little')),
  sodium_feedback TEXT CHECK (sodium_feedback IN ('too_much', 'just_right', 'too_little')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.race_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback"
  ON public.race_feedback
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_race_feedback_user_id ON public.race_feedback(user_id);
CREATE INDEX idx_race_feedback_race_id ON public.race_feedback(race_id);
