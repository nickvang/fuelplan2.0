import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * On first login, migrates body data from localStorage (`supplme_profile_body`)
 * to the `athlete_profiles` table, then clears localStorage.
 */
export function useLocalStorageMigration(userId: string | undefined) {
  const migrated = useRef(false);

  useEffect(() => {
    if (!userId || migrated.current) return;

    const raw = localStorage.getItem('supplme_profile_body');
    if (!raw) return;

    try {
      const saved = JSON.parse(raw);
      migrated.current = true;

      supabase
        .from('athlete_profiles')
        .upsert(
          {
            user_id: userId,
            full_name: saved.fullName ?? null,
            age: saved.age ?? null,
            sex: saved.sex ?? null,
            height: saved.height ?? null,
            weight: saved.weight ?? null,
            body_fat: saved.bodyFat ?? null,
            resting_heart_rate: saved.restingHeartRate ?? null,
            hrv: saved.hrv ?? null,
            sleep_hours: saved.sleepHours ?? null,
            sleep_quality: saved.sleepQuality ?? null,
          },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (!error) {
            localStorage.removeItem('supplme_profile_body');
          } else {
            console.error('[useLocalStorageMigration] upsert failed:', error);
            migrated.current = false;
          }
        });
    } catch {
      // ignore parse errors
    }
  }, [userId]);
}
