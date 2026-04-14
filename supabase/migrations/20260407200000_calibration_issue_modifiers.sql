-- ============================================================
-- Migration: Add issue-driven calibration modifiers
-- Cramping → sodium_loss_modifier (cap 1.3)
-- Bloating/Nausea → gi_tolerance_ceiling_ml_hr (floor 400)
-- ============================================================

ALTER TABLE public.athlete_calibration
  ADD COLUMN IF NOT EXISTS sodium_loss_modifier NUMERIC(4,3) NOT NULL DEFAULT 1.000,
  ADD COLUMN IF NOT EXISTS gi_tolerance_ceiling_ml_hr INTEGER NOT NULL DEFAULT 800;

-- Safety bounds
ALTER TABLE public.athlete_calibration
  ADD CONSTRAINT sodium_loss_modifier_bounds CHECK (sodium_loss_modifier BETWEEN 0.70 AND 1.30);

ALTER TABLE public.athlete_calibration
  ADD CONSTRAINT gi_tolerance_bounds CHECK (gi_tolerance_ceiling_ml_hr BETWEEN 400 AND 800);
