-- Add sent_reminders tracking to athlete_races
ALTER TABLE public.athlete_races
  ADD COLUMN IF NOT EXISTS sent_reminders JSONB DEFAULT '{}';

-- Example value: {"30day":"2026-03-08","14day":"2026-03-22","7day":"2026-03-29","2day":"2026-04-04","raceday":"2026-04-06","evening":"2026-04-06","postrace":"2026-04-07"}

-- Atomic, idempotent function to mark a reminder as sent.
-- The WHERE guard ensures a reminder is never marked twice,
-- even if two cron invocations race.
CREATE OR REPLACE FUNCTION public.mark_reminder_sent(
  p_race_id UUID,
  p_reminder_type TEXT,
  p_sent_at TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.athlete_races
  SET sent_reminders = sent_reminders || jsonb_build_object(p_reminder_type, p_sent_at)
  WHERE id = p_race_id
    AND NOT (sent_reminders ? p_reminder_type);
END;
$$;
