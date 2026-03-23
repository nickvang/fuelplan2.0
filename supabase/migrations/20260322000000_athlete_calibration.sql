-- Athlete calibration table for adaptive learning from post-session feedback.
-- Stores Bayesian-updated coefficients that adjust future hydration plans.

create table if not exists public.athlete_calibration (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Multiplicative coefficients (1.0 = neutral, bounded 0.65–1.35)
  sweat_coefficient numeric(4,3) not null default 1.000,
  sodium_coefficient numeric(4,3) not null default 1.000,
  water_coefficient numeric(4,3) not null default 1.000,
  pre_water_coefficient numeric(4,3) not null default 1.000,

  -- Feedback tracking
  total_feedback_count integer not null default 0,

  -- Condition-specific outcome tracking (e.g. {"cramping": {"better": 2, "same": 1, "worse": 0}})
  condition_outcomes jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint unique_user_calibration unique (user_id),
  constraint sweat_coeff_bounds check (sweat_coefficient between 0.65 and 1.35),
  constraint sodium_coeff_bounds check (sodium_coefficient between 0.65 and 1.35),
  constraint water_coeff_bounds check (water_coefficient between 0.65 and 1.35),
  constraint pre_water_coeff_bounds check (pre_water_coefficient between 0.65 and 1.35)
);

-- RLS: users can only read/write their own calibration
alter table public.athlete_calibration enable row level security;

create policy "Users can view own calibration"
  on public.athlete_calibration for select
  using (auth.uid() = user_id);

create policy "Users can insert own calibration"
  on public.athlete_calibration for insert
  with check (auth.uid() = user_id);

create policy "Users can update own calibration"
  on public.athlete_calibration for update
  using (auth.uid() = user_id);

-- Index for fast lookup by user
create index if not exists idx_athlete_calibration_user_id on public.athlete_calibration(user_id);
