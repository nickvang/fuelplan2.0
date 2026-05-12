import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { HydrationProfile, AthleteCalibration } from '@/types/hydration';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { validateAndSanitizeProfile } from '@/utils/profileValidation';
import { parseSmartWatchFiles } from '@/utils/garminDataParser';
import { calculateTriathlonDuration, getTriathlonBreakdown, TRIATHLON_DISTANCES, T1_DURATION, T2_DURATION } from '@/utils/triathlonCalculator';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import { HydrationPlanDisplay } from '@/components/HydrationPlanDisplay';
import { LoggedInHome } from '@/components/LoggedInHome';
import { InfoTooltip } from '@/components/InfoTooltip';
import { ValidationWarning, getValidationWarnings } from '@/components/ValidationWarning';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PaceDurationCalculator } from '@/components/PaceDurationCalculator';
import { DataSourceSelector, DataSource } from '@/components/DataSourceSelector';
import { ActivityRaceSelector } from '@/components/ActivityRaceSelector';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRace, Race } from '@/contexts/RaceContext';
import { RaceSelector } from '@/components/RaceSelector';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ArrowRight, ListOrdered, X } from 'lucide-react';
import supplmeLogo from '@/assets/supplme-logo-sort.svg';
import { SupplmeIcon, SupplmeWordmark } from '@/components/SupplmeBrandAssets';
import { STRAVA_PREFILL_KEY, STRAVA_STATE_KEY, STRAVA_ERROR_KEY } from './StravaCallback';
import { GARMIN_STATE_KEY, GARMIN_PREFILL_KEY, GARMIN_CODE_VERIFIER_KEY, GARMIN_ERROR_KEY } from './GarminCallback';

const generateStravaState = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
};

async function generatePKCE() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { verifier, challenge };
}

const Index = () => {
  console.log('[Index] component rendering');
  const { t } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedRace, setSelectedRace } = useRace();
  const [showHome, setShowHome] = useState(false); // Skip LoggedInHome, go straight to questionnaire
  const [version, setVersion] = useState<'pro' | null>('pro'); // Single flow (no Quick/Pro choice)
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [step, setStep] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
  const [welcomeBannerDismissed, setWelcomeBannerDismissed] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false); // GDPR: explicit opt-in required
  const [healthConsentGiven, setHealthConsentGiven] = useState(false);
  const [algorithmConsentGiven, setAlgorithmConsentGiven] = useState(false);
  const [smartwatchData, setSmartWatchData] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<Partial<HydrationProfile> | null>(null);
  const [rawSmartWatchData, setRawSmartWatchData] = useState<any>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState(''); // Bot protection
  const [profilePreFilled, setProfilePreFilled] = useState(false);
  const upsertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [stravaSnapshot, setStravaSnapshot] = useState<{ athlete: unknown; activities: unknown[] } | null>(null);
  const [stravaBirthYearInput, setStravaBirthYearInput] = useState('');
  const [garminSnapshot, setGarminSnapshot] = useState<{ userId: string; permissions?: string[] } | null>(null);
  const [garminConnectionId, setGarminConnectionId] = useState<string | null>(null);
  const [userCalibration, setUserCalibration] = useState<AthleteCalibration | null>(null);
  const isInitialMount = useRef(true);
  const stravaPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const garminPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const garminDataPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up popup polls on unmount
  useEffect(() => {
    return () => {
      if (stravaPollRef.current) {
        clearInterval(stravaPollRef.current);
        stravaPollRef.current = null;
      }
      if (garminPollRef.current) {
        clearInterval(garminPollRef.current);
        garminPollRef.current = null;
      }
      if (garminDataPollRef.current) {
        clearInterval(garminDataPollRef.current);
        garminDataPollRef.current = null;
      }
    };
  }, []);

  // Fetch athlete calibration for logged-in users
  useEffect(() => {
    if (!user) { setUserCalibration(null); return; }
    supabase
      .from('athlete_calibration')
      .select('sweat_coefficient, sodium_coefficient, water_coefficient, pre_water_coefficient, sodium_loss_modifier, gi_tolerance_ceiling_ml_hr, total_feedback_count, condition_outcomes')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setUserCalibration(data as unknown as AthleteCalibration);
      });
  }, [user]);

  // 4-page UX: Source+Body → Activity+Race → Sweat → Diet
  const uiStep = step + 1; // step 0→1, 1→2, 2→3, 3→4
  const uiTotalSteps = 4;

  // Scroll so the step card / main content is at top of viewport on every view change.
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const scrollToCardTop = () => {
      if (isGenerating) {
        document.getElementById('generating-view')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else if (showPlan) {
        window.scrollTo(0, 0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        document.getElementById('results-page')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else if (step === 0) {
        document.getElementById('step-0-content')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else if (step === 1) {
        document.getElementById('step-1-content')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else {
        document.getElementById('questionnaire-step')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      }
    };
    let timeoutId: ReturnType<typeof setTimeout>;
    requestAnimationFrame(() => {
      scrollToCardTop();
      requestAnimationFrame(() => {
        scrollToCardTop();
        // Extra delay so step 2+ card is mounted and laid out (fixes "Step 2 of 2" not starting at top)
        timeoutId = setTimeout(scrollToCardTop, 100);
      });
    });
    return () => clearTimeout(timeoutId);
  }, [step, showPlan, isGenerating]);

  // Apply Strava prefill (accuracy fields only). Used on initial load and when popup returns.
  const applyStravaPrefill = useCallback(() => {
    const raw = sessionStorage.getItem(STRAVA_PREFILL_KEY) || localStorage.getItem(STRAVA_PREFILL_KEY);
    if (!raw) return;
    try {
      const { prefill, strava_snapshot } = JSON.parse(raw);
      sessionStorage.removeItem(STRAVA_PREFILL_KEY);
      localStorage.removeItem(STRAVA_PREFILL_KEY);
      if (prefill && typeof prefill === 'object') {
        const prefillKeys = ['fullName', 'age', 'sex', 'height', 'weight', 'restingHeartRate', 'sessionDuration', 'indoorOutdoor', 'avgPace', 'runPace', 'bikeSpeed'] as const;
        const filtered: Partial<HydrationProfile> = {};
        for (const k of prefillKeys) {
          if (prefill[k] !== undefined && prefill[k] !== null) filtered[k] = prefill[k] as never;
        }
        if (Array.isArray(prefill.disciplines) && prefill.disciplines.length > 0) {
          filtered.disciplines = prefill.disciplines;
        }
        if (Object.keys(filtered).length > 0) {
          setProfile((prev) => ({ ...prev, ...filtered }));
        }
        if (prefill.hrProfile && typeof prefill.hrProfile === 'object') {
          setProfile((prev) => ({ ...prev, hrProfile: prefill.hrProfile as any }));
        }
        if (strava_snapshot) {
          setStravaSnapshot(strava_snapshot);
          setDataSource('strava');
        }
        toast.success(t('strava.connected'));
      }
    } catch {
      sessionStorage.removeItem(STRAVA_PREFILL_KEY);
      localStorage.removeItem(STRAVA_PREFILL_KEY);
    }
  }, [t]);

  // Strava: handle callback error param (URL) and apply prefill from sessionStorage on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('strava') === 'error') {
      params.delete('strava');
      const newSearch = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
      const detail = sessionStorage.getItem(STRAVA_ERROR_KEY) || localStorage.getItem(STRAVA_ERROR_KEY);
      sessionStorage.removeItem(STRAVA_ERROR_KEY);
      localStorage.removeItem(STRAVA_ERROR_KEY);
      return;
    }
    applyStravaPrefill();
  }, [t, applyStravaPrefill]);

  // Apply Garmin prefill from callback data (connection info + start polling for activities)
  const applyGarminPrefill = useCallback(() => {
    const raw = sessionStorage.getItem(GARMIN_PREFILL_KEY) || localStorage.getItem(GARMIN_PREFILL_KEY);
    if (!raw) return;
    try {
      const { garmin_snapshot, connectionId } = JSON.parse(raw);
      sessionStorage.removeItem(GARMIN_PREFILL_KEY);
      localStorage.removeItem(GARMIN_PREFILL_KEY);
      if (garmin_snapshot) {
        setGarminSnapshot(garmin_snapshot);
        setDataSource('garmin');
        toast.success(t('garmin.connected'));
      }
      if (connectionId) {
        setGarminConnectionId(connectionId);
      }
    } catch {
      sessionStorage.removeItem(GARMIN_PREFILL_KEY);
      localStorage.removeItem(GARMIN_PREFILL_KEY);
    }
  }, [t]);

  // Strava/Garmin popup: listen for success/error from callback so we don't refresh the page
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'strava-connected') {
        applyStravaPrefill();
      }
      if (e.data?.type === 'garmin-connected') {
        applyGarminPrefill();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [t, applyStravaPrefill, applyGarminPrefill]);

  // Garmin: handle callback error param and apply prefill on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('garmin') === 'error') {
      params.delete('garmin');
      const newSearch = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
      const detail = sessionStorage.getItem(GARMIN_ERROR_KEY) || localStorage.getItem(GARMIN_ERROR_KEY);
      sessionStorage.removeItem(GARMIN_ERROR_KEY);
      localStorage.removeItem(GARMIN_ERROR_KEY);
      return;
    }
    applyGarminPrefill();
  }, [t, applyGarminPrefill]);

  // Poll for Garmin activity data after connection
  useEffect(() => {
    if (!garminConnectionId) return;
    if (garminDataPollRef.current) clearInterval(garminDataPollRef.current);

    const startTime = Date.now();
    const POLL_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes
    const POLL_INTERVAL_MS = 3000;

    garminDataPollRef.current = setInterval(async () => {
      if (Date.now() - startTime > POLL_TIMEOUT_MS) {
        clearInterval(garminDataPollRef.current!);
        garminDataPollRef.current = null;
        toast.info(t('garmin.syncPending'));
        return;
      }

      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/garmin-connect?poll=true&connectionId=${garminConnectionId}`,
          { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
        );
        const pollData = await res.json();

        if (pollData && !pollData.pending && pollData.prefill) {
          clearInterval(garminDataPollRef.current!);
          garminDataPollRef.current = null;

          const { prefill } = pollData;
          if (prefill && typeof prefill === 'object') {
            const updates: Partial<HydrationProfile> = {};
            if (prefill.weight != null) updates.weight = prefill.weight;
            if (prefill.bodyFat != null) updates.bodyFat = prefill.bodyFat;
            if (prefill.restingHeartRate != null) updates.restingHeartRate = prefill.restingHeartRate;
            if (prefill.sleepHours != null) updates.sleepHours = prefill.sleepHours;
            if (prefill.sessionDuration != null) updates.sessionDuration = prefill.sessionDuration;
            if (prefill.indoorOutdoor) updates.indoorOutdoor = prefill.indoorOutdoor;
            if (Array.isArray(prefill.disciplines) && prefill.disciplines.length > 0) {
              updates.disciplines = prefill.disciplines;
            }
            if (Object.keys(updates).length > 0) {
              setProfile((prev) => ({ ...prev, ...updates }));
            }
            if (prefill.hrProfile && typeof prefill.hrProfile === 'object') {
              setProfile((prev) => ({ ...prev, hrProfile: prefill.hrProfile as any }));
            }
          }
          if (pollData.garmin_snapshot) {
            setGarminSnapshot((prev) => ({ ...prev, ...pollData.garmin_snapshot }));
          }
        }
      } catch {
        // Continue polling on errors
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (garminDataPollRef.current) {
        clearInterval(garminDataPollRef.current);
        garminDataPollRef.current = null;
      }
    };
  }, [garminConnectionId, t]);

  const [profile, setProfile] = useState<Partial<HydrationProfile>>({
    primaryGoal: 'performance',
    disciplines: [],
    // Simple mode defaults (hidden from user) - no temperature default
    humidity: 50,
    altitude: 'sea-level',
    sunExposure: 'partial',
    windConditions: 'calm',
    clothingType: 'light',
    sweatRate: 'medium',
    sweatSaltiness: 'medium',
    dailySaltIntake: 'medium',
    hasUpcomingRace: true,
  });

  const updateProfile = (updates: Partial<HydrationProfile>) => {
    setProfile((prev) => {
      const newProfile = { ...prev, ...updates };
      setValidationWarnings(getValidationWarnings(newProfile));
      return newProfile;
    });
  };

  // Load saved body data: from athlete_profiles (authenticated) or localStorage (anonymous)
  useEffect(() => {
    if (user) {
      supabase
        .from('athlete_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          const mapped: Partial<HydrationProfile> = {};
          if (data.full_name) mapped.fullName = data.full_name;
          if (data.age != null) mapped.age = data.age;
          if (data.sex) mapped.sex = data.sex as any;
          if (data.height != null) mapped.height = Number(data.height);
          if (data.weight != null) mapped.weight = Number(data.weight);
          if (data.body_fat != null) mapped.bodyFat = Number(data.body_fat);
          if (data.resting_heart_rate != null) mapped.restingHeartRate = data.resting_heart_rate;
          if (data.hrv) mapped.hrv = data.hrv;
          if (data.sleep_hours != null) mapped.sleepHours = Number(data.sleep_hours);
          if (data.sleep_quality != null) mapped.sleepQuality = data.sleep_quality;
          if (data.sweat_rate) mapped.sweatRate = data.sweat_rate as any;
          if (data.sweat_saltiness) mapped.sweatSaltiness = data.sweat_saltiness as any;
          if (data.known_sodium_loss != null) mapped.sweatSodiumTest = Number(data.known_sodium_loss);

          const hasBody = mapped.age != null && mapped.sex && mapped.weight != null && mapped.height != null;
          if (hasBody) setProfilePreFilled(true);

          setProfile((prev) => ({ ...prev, ...mapped }));
        });
    } else {
      try {
        const raw = localStorage.getItem('supplme_profile_body');
        if (raw) {
          const saved = JSON.parse(raw);
          setProfile((prev) => ({ ...prev, ...saved }));
        }
      } catch {
        // ignore parse errors
      }
    }
  }, [user]);

  useEffect(() => {
    if (!consentGiven) return;
    // Only store a compact subset of body-related fields
    const bodySnapshot: Partial<HydrationProfile> = {
      fullName: profile.fullName,
      age: profile.age,
      sex: profile.sex,
      height: profile.height,
      weight: profile.weight,
      bodyFat: profile.bodyFat,
      restingHeartRate: profile.restingHeartRate,
      hrv: profile.hrv,
      sleepHours: profile.sleepHours,
      sleepQuality: profile.sleepQuality,
    } as Partial<HydrationProfile>;

    const hasValues = Object.values(bodySnapshot).some(
      (v) => v !== undefined && v !== null && v !== ''
    );
    if (!hasValues) return;

    if (user) {
      // Debounced upsert to athlete_profiles
      if (upsertTimerRef.current) clearTimeout(upsertTimerRef.current);
      upsertTimerRef.current = setTimeout(() => {
        supabase.from('athlete_profiles').upsert(
          {
            user_id: user.id,
            full_name: bodySnapshot.fullName ?? null,
            age: bodySnapshot.age ?? null,
            sex: bodySnapshot.sex ?? null,
            height: bodySnapshot.height ?? null,
            weight: bodySnapshot.weight ?? null,
            body_fat: bodySnapshot.bodyFat ?? null,
            resting_heart_rate: bodySnapshot.restingHeartRate ?? null,
            hrv: bodySnapshot.hrv ?? null,
            sleep_hours: bodySnapshot.sleepHours ?? null,
            sleep_quality: bodySnapshot.sleepQuality ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );
      }, 1500);
    } else if (consentGiven) {
      // GDPR: only persist personal data after explicit consent
      try {
        localStorage.setItem('supplme_profile_body', JSON.stringify(bodySnapshot));
      } catch {
        // ignore storage errors
      }
    }
  }, [user, consentGiven, profile.fullName, profile.age, profile.sex, profile.height, profile.weight, profile.bodyFat, profile.restingHeartRate, profile.hrv, profile.sleepHours, profile.sleepQuality]);

  // Handle pending plan save after login redirect
  useEffect(() => {
    if (!user || searchParams.get('savePlan') !== 'true') return;

    const raw = sessionStorage.getItem('supplme_pending_plan');
    if (!raw) return;

    try {
      const { profileData, planData } = JSON.parse(raw);
      if (profileData && planData) {
        supabase.functions.invoke('save-hydration-profile', {
          body: {
            profile: profileData,
            plan: planData,
            consentGiven: true,
            hasSmartWatchData: false,
          },
        }).then(({ error }) => {
          if (!error) {
            toast.success(t('auth.planSaved'));
          }
        });
      }
    } catch { /* ignore */ }

    sessionStorage.removeItem('supplme_pending_plan');
    setSearchParams((prev) => {
      prev.delete('savePlan');
      prev.delete('returnTo');
      return prev;
    }, { replace: true });
  }, [user]);

  function mapTriathlonDistanceKey(distanceKm: number): string {
    if (distanceKm >= 220 && distanceKm <= 230) return 'Ironman';
    if (distanceKm >= 110 && distanceKm <= 116) return 'Half Ironman';
    if (distanceKm >= 50 && distanceKm <= 53) return 'Olympic';
    if (distanceKm >= 24 && distanceKm <= 27) return 'Sprint';
    return `${distanceKm} km`;
  }

  const applyRaceToProfile = (race: Race | null) => {
    setSelectedRace(race);
    if (!race) {
      // Custom Event – keep fields in their current / default state for manual entry
      return;
    }

    const midTemp =
      (race.typical_temp_c?.min ?? race.typical_temp_c?.max ?? 0) +
      (race.typical_temp_c?.max ?? race.typical_temp_c?.min ?? 0);
    const avgTemp = midTemp ? midTemp / 2 : undefined;

    // Map altitude in meters to existing altitude buckets
    const finishAlt = race.altitude_finish_m ?? race.altitude_start_m ?? 0;
    let altitude: HydrationProfile['altitude'] = 'sea-level';
    if (finishAlt > 2500) {
      altitude = 'high';
    } else if (finishAlt > 1000) {
      altitude = 'moderate';
    }

    const distanceLabel =
      race.distance_km % 1 === 0
        ? `${race.distance_km.toFixed(0)} km`
        : `${race.distance_km.toFixed(1)} km`;

    // Map race surface to terrain value
    const surfaceToTerrain: Record<string, string> = {
      road: race.sport === 'cycling' ? 'road-bike' : 'road',
      trail: race.sport === 'cycling' ? 'mountain-bike' : 'trail',
      gravel: race.sport === 'cycling' ? 'gravel-bike' : 'gravel',
      mixed: race.sport === 'cycling' ? 'mixed-cycling' : 'mixed',
      track: 'track',
    };
    const terrain = race.sport === 'triathlon'
      ? 'road-triathlon'
      : surfaceToTerrain[race.surface] || (race.sport === 'cycling' ? 'road-bike' : 'road');

    // Estimate session duration from race distance (always override — race distance is authoritative)
    let estimatedDuration: Partial<HydrationProfile> = {};
    if (race.distance_km) {
      let estimatedHours: number | undefined;
      const primaryDiscipline = profile.disciplines?.[0] || '';

      // Stage races: use the longest stage midpoint as the session duration
      if (race.is_stage_race && Array.isArray(race.stages) && race.stages.length > 0) {
        let maxMidpoint = 0;
        for (const stage of race.stages) {
          const mid = (stage.typical_duration_h.min + stage.typical_duration_h.max) / 2;
          if (mid > maxMidpoint) maxMidpoint = mid;
        }
        if (maxMidpoint > 0) estimatedHours = maxMidpoint;
      } else if (primaryDiscipline === 'Running') {
        let paceMinPerKm = 5.5; // default fallback
        const stravaRunPace = (profile as any).hrProfile?.['Running']?.avgPaceMinPerKm;
        if (stravaRunPace && stravaRunPace > 2.5 && stravaRunPace < 12) {
          paceMinPerKm = stravaRunPace;
        }
        estimatedHours = (race.distance_km * paceMinPerKm) / 60;
      } else if (primaryDiscipline === 'Cycling') {
        let speedKmh = 28; // default fallback
        const stravaSpeed = (profile as any).hrProfile?.['Cycling']?.avgSpeedKmh;
        if (stravaSpeed && stravaSpeed > 10 && stravaSpeed < 60) {
          speedKmh = stravaSpeed;
        }
        estimatedHours = race.distance_km / speedKmh;
      }
      if (estimatedHours && isFinite(estimatedHours)) {
        estimatedDuration = { sessionDuration: estimatedHours };
      }
    }

    updateProfile({
      hasUpcomingRace: true,
      upcomingEvents: race.name,
      raceDistance: race.sport === 'triathlon'
        ? mapTriathlonDistanceKey(race.distance_km)
        : distanceLabel,
      elevationGain: race.elevation_gain_m,
      terrain,
      trainingTempRange: {
        min: race.typical_temp_c.min,
        max: race.typical_temp_c.max,
      },
      raceTempRange: {
        min: race.typical_temp_c.min,
        max: race.typical_temp_c.max,
      },
      humidity: race.typical_humidity_pct,
      altitude,
      altitudeMeters: finishAlt,
      indoorOutdoor: 'outdoor',
      sunExposure: 'partial',
      windConditions: 'moderate',
      clothingType: 'light',
      course_profile: race.course_profile,
      is_stage_race: !!race.is_stage_race,
      ...estimatedDuration,
    } as Partial<HydrationProfile>);

    // If no race temp range previously set, also mirror into training temp range
    if (!profile.trainingTempRange) {
      updateProfile({
        trainingTempRange: {
          min: race.typical_temp_c.min,
          max: race.typical_temp_c.max,
        },
      } as Partial<HydrationProfile>);
    }
  };

  // Analyze uploaded smartwatch files
  const analyzeSmartWatchFiles = async (files: File[]): Promise<Partial<HydrationProfile>> => {
    setIsAnalyzing(true);

    try {
      // Parse smartwatch files (Garmin or Whoop)
      const { profile: extractedData, rawData } = await parseSmartWatchFiles(files);

      // Store raw data for enhanced calculations
      setRawSmartWatchData(rawData);

      setIsAnalyzing(false);

      if (Object.keys(extractedData).length > 0) {
        toast.success('Smartwatch data analyzed successfully!');
      }

      return extractedData;
    } catch (error) {
      console.error('Error analyzing smartwatch files:', error);
      setIsAnalyzing(false);
      return {};
    }
  };

  // Determine which steps to skip based on analyzed data (steps 1–4 = body, env, sweat, nutrition)
  const shouldSkipStep = (stepNumber: number): boolean => {
    if (!analyzedData) return false;
    switch (stepNumber) {
      case 1: // Body & Physiology
        return !!(analyzedData.age && analyzedData.restingHeartRate);
      case 2: // Environment – never skip
        return false;
      case 3: // Sweat – skip if we have inferred data
        return !!(analyzedData.sweatRate && analyzedData.sweatSaltiness);
      case 4: // Nutrition – never skip
        return false;
      default:
        return false;
    }
  };

  // Strava/Garmin-connected users: body data comes from the platform
  const stravaShortFlow = !!version && (!!stravaSnapshot || !!garminSnapshot);

  // 4-page flow: 0(source+body) → 1(activity+race+env) → 2(sweat) → 3(diet) → done
  const getNextStep = (currentStep: number): number => {
    if (currentStep === 0) return 1;
    if (currentStep === 1) return 2;
    if (currentStep === 2) return 3;
    if (currentStep === 3) return 999;
    return 999;
  };

  const isStepValid = (): boolean => {
    switch (step) {
      case 0: { // Data source + consent + body (manual needs body fields)
        if (!consentGiven || !healthConsentGiven) return false;
        if (dataSource === 'strava') return !!stravaSnapshot && !!profile.age;
        if (dataSource === 'garmin') return !!garminSnapshot;
        if (dataSource === 'manual') return !!(profile.age && profile.sex && profile.height && profile.weight);
        return false;
      }
      case 1: // Activity & Race + environment
        if (!profile.disciplines?.length || !profile.raceDistance) return false;
        // Race selected: conditions auto-filled from race data, no manual fields needed
        if (selectedRace) return true;
        // Custom: require terrain + all condition fields
        return !!(profile.terrain &&
          profile.humidity !== undefined && profile.altitude &&
          profile.sunExposure && profile.windConditions && profile.clothingType);
      case 2: // Sweat Profile
        return !!(profile.sweatRate && profile.sweatSaltiness);
      case 3: // Dietary Habits
        return !!(profile.dailySaltIntake);
      default:
        return false;
    }
  };

  const handleNextStep = async () => {
    if (step === 0 && smartwatchData.length > 0 && !analyzedData) {
      // Analyze files on first step
      const data = await analyzeSmartWatchFiles(smartwatchData);
      setAnalyzedData(data);
      updateProfile(data);
      setStep(getNextStep(0));
    } else {
      const nextStep = getNextStep(step);
      if (nextStep === 999) {
        // Simple mode complete
        handleComplete();
      } else {
        setStep(nextStep);
      }
    }
    // Scroll to top runs in useEffect([step])
  };

  const handleBackStep = (targetStep: number) => {
    setStep(targetStep);
    // Scroll to top runs in useEffect([step])
  };

  const handleComplete = async () => {
    if (isStepValid()) {
      // Bot protection - if honeypot field is filled, it's a bot
      if (honeypot) {
        return;
      }

      setIsGenerating(true);

      const completeProfile = { ...profile };
      if (!completeProfile.indoorOutdoor) completeProfile.indoorOutdoor = 'outdoor';

      // Strava short flow: apply defaults for steps we skipped (body, activity, environment)
      if (stravaSnapshot) {
        if (!completeProfile.terrain) completeProfile.terrain = 'road';
        if (!completeProfile.trainingTempRange) completeProfile.trainingTempRange = { min: 15, max: 25 };
        if (completeProfile.humidity == null) completeProfile.humidity = 50;
        if (!completeProfile.altitude) completeProfile.altitude = 'sea-level';
        if (!completeProfile.sunExposure) completeProfile.sunExposure = 'partial';
        if (!completeProfile.windConditions) completeProfile.windConditions = 'calm';
        if (!completeProfile.clothingType) completeProfile.clothingType = 'light';
        if (completeProfile.height == null) completeProfile.height = 175;
        if (!completeProfile.raceDistance && completeProfile.disciplines?.[0]) completeProfile.raceDistance = 'Other';
      }

      try {
        // Validate and sanitize profile data before submission
        const validatedProfile = validateAndSanitizeProfile(completeProfile);
        const profileToSave = {
          ...validatedProfile,
          ...(stravaSnapshot && { strava_snapshot: stravaSnapshot }),
          ...(garminSnapshot && { garmin_snapshot: garminSnapshot }),
          ...(selectedRace?.name && { raceName: selectedRace.name }),
        };

        // Save profile data to backend with GDPR compliance
        const { data, error } = await supabase.functions.invoke('save-hydration-profile', {
          body: {
            profile: profileToSave,
            plan: calculateHydrationPlan(completeProfile as HydrationProfile),
            hasSmartWatchData: !!analyzedData && smartwatchData.length > 0,
            consentGiven,
            healthConsentGiven,
            algorithmConsentGiven,
            userEmail: null // Optional: could add email field for users who want to save
          }
        });

        if (error) {
          if (import.meta.env.DEV) {
            console.error('Error saving profile:', error);
          }
        } else if (data?.deletionToken) {
          // Store deletion token securely in localStorage for GDPR data deletion
          localStorage.setItem('hydration_deletion_token', data.deletionToken);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to save profile:', error);
        }

        if (error instanceof Error) {
          setIsGenerating(false);
          return;
        }
      }

      // Update profile with complete values before showing plan
      setProfile(completeProfile);

      // Add a minimum delay for smooth transition
      setTimeout(() => {
        setIsGenerating(false);
        setShowPlan(true);
      }, 1500);
    }
  };

  const handleReset = () => {
    setVersion('pro');
    setDataSource('strava');
    setStep(0);
    setShowPlan(false);
    setShowHome(false);
    setIsGenerating(false);
    setConsentGiven(false);
    localStorage.removeItem('supplme_profile_body');
    setSmartWatchData([]);
    setAnalyzedData(null);
    setRawSmartWatchData(null);
    setStravaSnapshot(null);
    setIsAnalyzing(false);
    setProfile({
      sweatRate: 'medium',
      sweatSaltiness: 'medium',
      dailySaltIntake: 'medium',
      primaryGoal: 'performance',
      disciplines: [],
      humidity: 50,
      altitude: 'sea-level',
      sunExposure: 'partial',
      windConditions: 'calm',
      clothingType: 'light',
    });
  };

  const handleResetWithData = () => {
    setShowPlan(false);
    setIsGenerating(false);
    setStep(1);
  };

  const goToMarathonResultsDev = () => {
    if (!import.meta.env.DEV) return;
    const marathonProfile: Partial<HydrationProfile> = {
      disciplines: ['Running'],
      terrain: 'road',
      raceDistance: 'Copenhagen Marathon',
      sessionDuration: 3.75, // ~3h45m realistic finish
      hasUpcomingRace: true,
      upcomingEvents: 'Copenhagen Marathon',
      age: 35,
      sex: 'male',
      height: 178,
      weight: 72,
      trainingTempRange: { min: 13, max: 17 }, // Copenhagen May conditions
      raceTempRange: { min: 13, max: 17 },
      humidity: 70,
      altitude: 'sea-level',
      sunExposure: 'partial',
      windConditions: 'calm',
      clothingType: 'light',
      sweatRate: 'medium',
      sweatSaltiness: 'medium',
      dailySaltIntake: 'medium',
      primaryGoal: 'performance',
      indoorOutdoor: 'outdoor',
    };
    setProfile(marathonProfile);
    setShowPlan(true);
  };

  const toggleDiscipline = (discipline: string) => {
    const current = profile.disciplines || [];
    if (current.includes(discipline)) {
      updateProfile({ disciplines: current.filter(d => d !== discipline) });
    } else {
      updateProfile({ disciplines: [...current, discipline] });
    }
  };

  // OAuth trigger handlers — extracted from hidden div for clean JSX
  const handleStravaOAuthClick = useCallback(() => {
    const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
    const redirectBase = typeof window !== 'undefined'
      ? (window.location.hostname.endsWith('supplme.app') ? 'https://supplme.app' : window.location.origin)
      : '';
    const redirectUri = redirectBase ? `${redirectBase}/strava-callback` : '';
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!clientId || !redirectUri) return;
    const state = generateStravaState();
    sessionStorage.setItem(STRAVA_STATE_KEY, state);
    localStorage.setItem(STRAVA_STATE_KEY, JSON.stringify({ state, ts: Date.now() }));
    const params = new URLSearchParams({
      client_id: String(clientId),
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: 'read,profile:read_all,activity:read_all',
      state,
      approval_prompt: 'auto',
    });
    const webUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
    if (isMobile) {
      window.location.href = `https://www.strava.com/oauth/mobile/authorize?${params.toString()}`;
      return;
    }
    const width = 500, height = 600;
    const left = Math.round((window.screen.width - width) / 2);
    const top = Math.round((window.screen.height - height) / 2);
    const popup = window.open(webUrl, 'strava-auth', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
    if (!popup || popup.closed) { window.location.href = webUrl; return; }
    sessionStorage.setItem('strava_use_popup', '1');
    const startTime = Date.now();
    const POPUP_TIMEOUT_MS = 5 * 60 * 1000;
    if (stravaPollRef.current) clearInterval(stravaPollRef.current);
    stravaPollRef.current = setInterval(() => {
      try {
        if (popup.closed) {
          clearInterval(stravaPollRef.current!);
          stravaPollRef.current = null;
          sessionStorage.removeItem('strava_use_popup');
          if (localStorage.getItem(STRAVA_PREFILL_KEY) || sessionStorage.getItem(STRAVA_PREFILL_KEY)) {
            applyStravaPrefill();
          }
        } else if (Date.now() - startTime > POPUP_TIMEOUT_MS) {
          clearInterval(stravaPollRef.current!);
          stravaPollRef.current = null;
          sessionStorage.removeItem('strava_use_popup');
          popup.close();
        }
      } catch { /* cross-origin access error = popup navigated to Strava, normal */ }
    }, 500);
  }, [applyStravaPrefill]);

  const handleGarminOAuthClick = useCallback(async () => {
    const garminClientId = import.meta.env.VITE_GARMIN_CLIENT_ID;
    const redirectBase = typeof window !== 'undefined'
      ? (window.location.hostname.endsWith('supplme.app') ? 'https://supplme.app' : window.location.origin)
      : '';
    const garminRedirectUri = redirectBase ? `${redirectBase}/garmin-callback` : '';
    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!garminClientId || !garminRedirectUri) return;
    const state = generateStravaState();
    const { verifier, challenge } = await generatePKCE();
    sessionStorage.setItem(GARMIN_STATE_KEY, state);
    localStorage.setItem(GARMIN_STATE_KEY, JSON.stringify({ state, ts: Date.now() }));
    localStorage.setItem(GARMIN_CODE_VERIFIER_KEY, verifier);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: String(garminClientId),
      code_challenge: challenge,
      code_challenge_method: 'S256',
      redirect_uri: garminRedirectUri,
      state,
      scope: 'GHS_DAILIES GHS_ACTIVITIES GHS_BODY_COMPOSITIONS GHS_USER_PROFILE',
    });
    const authUrl = `https://connect.garmin.com/oauth2Confirm?${params.toString()}`;
    if (isMobile) { window.location.href = authUrl; return; }
    const width = 500, height = 600;
    const left = Math.round((window.screen.width - width) / 2);
    const top = Math.round((window.screen.height - height) / 2);
    const popup = window.open(authUrl, 'garmin-auth', `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`);
    if (!popup) { toast.info(t('garmin.popupFallback')); window.location.href = authUrl; return; }
    sessionStorage.setItem('garmin_use_popup', '1');
    const startTime = Date.now();
    const POPUP_TIMEOUT_MS = 5 * 60 * 1000;
    if (garminPollRef.current) clearInterval(garminPollRef.current);
    garminPollRef.current = setInterval(() => {
      if (popup.closed) {
        clearInterval(garminPollRef.current!);
        garminPollRef.current = null;
        sessionStorage.removeItem('garmin_use_popup');
        if (sessionStorage.getItem(GARMIN_PREFILL_KEY)) {
          applyGarminPrefill();
        } else {
          const errMsg = sessionStorage.getItem(GARMIN_ERROR_KEY) || localStorage.getItem(GARMIN_ERROR_KEY);
          sessionStorage.removeItem(GARMIN_ERROR_KEY);
          localStorage.removeItem(GARMIN_ERROR_KEY);
          void errMsg; // consumed for side-effect
        }
      } else if (Date.now() - startTime > POPUP_TIMEOUT_MS) {
        clearInterval(garminPollRef.current!);
        garminPollRef.current = null;
        sessionStorage.removeItem('garmin_use_popup');
        popup.close();
      }
    }, 300);
  }, [applyGarminPrefill, t]);

  console.log('[Index] render path: isGenerating=', isGenerating, 'showPlan=', showPlan, 'step=', step);

  // Authenticated users with showHome → LoggedInHome (skipped during questionnaire/plan flow)
  if (!authLoading && user && showHome && !showPlan && !isGenerating) {
    return (
      <LoggedInHome
        onStartQuestionnaire={() => setShowHome(false)}
        onRedoPlan={(profileData) => {
          // Merge saved profile data into current profile, skip Step 0 (body/source), go to Step 1 (activity/race)
          setProfile((prev) => ({ ...prev, ...profileData }));
          setStep(1);
          setShowHome(false);
        }}
      />
    );
  }

  // Show generating animation
  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background flex items-center justify-center px-4 relative overflow-hidden">
        {/* Athletic background pattern */}
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, currentColor 35px, currentColor 36px)',
          }}></div>
        </div>

        <div className="text-center space-y-10 animate-fade-in relative z-10">
          <div className="relative">
            <div className="absolute inset-0 glow-effect blur-3xl opacity-40 animate-pulse"></div>
            <img
              src={supplmeLogo}
              alt="Supplme"
              className="h-40 md:h-48 mx-auto relative z-10 performance-pulse"
            />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter chrome-shine uppercase">
              {t('plan.generatingTitle')}
            </h2>
            <p className="text-xl md:text-2xl font-bold text-muted-foreground tracking-wide">
              {t('plan.generatingSubtitle')}
            </p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="w-4 h-4 bg-primary rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0ms' }}></div>
            <div className="w-4 h-4 bg-chrome rounded-full animate-bounce shimmer shadow-lg" style={{ animationDelay: '150ms' }}></div>
            <div className="w-4 h-4 bg-primary rounded-full animate-bounce shadow-lg" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (showPlan && profile as HydrationProfile) {
    // Inject calibration data for logged-in users before calculation
    const profileWithCalibration = userCalibration
      ? { ...profile, calibration: userCalibration } as HydrationProfile
      : profile as HydrationProfile;
    const plan = calculateHydrationPlan(profileWithCalibration, rawSmartWatchData);
    return (
      <div id="results-page" className="min-h-screen min-w-0 bg-gradient-to-b from-background via-background to-primary/5 py-6 sm:py-12 px-3 sm:px-4 overflow-x-hidden pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {import.meta.env.DEV && (
          <div className="max-w-5xl mx-auto px-3 sm:px-4 mb-2">
            <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground" onClick={handleReset}>
              Dev: Back to start (Marathon button is on front page)
            </Button>
          </div>
        )}
        <div className="max-w-5xl mx-auto min-w-0">
          <HydrationPlanDisplay
            plan={plan}
            profile={profile as HydrationProfile}
            onReset={handleResetWithData}
            onFullReset={handleReset}
            hasSmartWatchData={!!analyzedData && smartwatchData.length > 0}
            hasStrava={!!stravaSnapshot}
            rawSmartWatchData={rawSmartWatchData}
            version={version || undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen min-w-0 relative overflow-x-hidden pb-[max(2rem,env(safe-area-inset-bottom))] ${step === 0 ? 'bg-white' : 'bg-background pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6'}`}>

      <div className={`mx-auto min-w-0 relative z-10 ${step === 0 ? 'max-w-[540px]' : 'max-w-2xl px-3 sm:px-4 md:px-6 space-y-4 sm:space-y-6'}`}>
        {/* Brand Header — step 0 */}
        {step === 0 && (
          <header className="flex justify-between items-center px-5 pt-[52px] pb-4 border-b border-black/10">
            <div className="flex items-center gap-2.5">
              <SupplmeIcon size={22} />
              <SupplmeWordmark height={14} />
            </div>
            <div className="flex items-center gap-3">
              {import.meta.env.DEV && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={goToMarathonResultsDev}
                >
                  Dev: Marathon
                </Button>
              )}
              <span className="font-mono text-[9px] tracking-[1.8px] text-[#8A9099]">FUEL / V2</span>
            </div>
          </header>
        )}

        {/* Existing header — steps 1+ */}
        {step > 0 && (
          <div className="text-center px-3 sm:px-4 pt-4">
            <div className="flex justify-end items-center gap-2 mb-2">
              <LanguageSwitcher />
            </div>
            <img src={supplmeLogo} alt="Supplme" className="h-16 sm:h-20 mx-auto max-w-full w-auto" />
          </div>
        )}

        {/* Welcome banner for logged-in users */}
        {user && !welcomeBannerDismissed && step === 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-black/10 bg-[#F7F8F9]">
            <p className="font-mono text-[9px] tracking-[1.4px] text-[#8A9099] uppercase">
              {t('home.welcomeBack', { name: user.user_metadata?.full_name || user.email?.split('@')[0] || '' })}
            </p>
            <button onClick={() => setWelcomeBannerDismissed(true)} className="text-[#8A9099] hover:text-[#0A0A0A] p-1 shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Honeypot field - hidden from real users, visible to bots */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
          aria-hidden="true"
        />

        {/* Progress bar — only for steps 1+ */}
        {!isAnalyzing && step > 0 && (
          <div className="px-3 sm:px-4 pt-2">
            <ProgressBar currentStep={uiStep} totalSteps={uiTotalSteps} />
          </div>
        )}

        {/* Analyzing Indicator */}
        {isAnalyzing && (
          <div id="generating-view" className="mx-5 mt-6 border border-black/10 p-6 animate-fade-in">
            <div className="flex items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#0A0A0A] border-t-transparent"></div>
              <div className="space-y-1">
                <p className="font-display font-semibold text-[16px] uppercase tracking-wide text-[#0A0A0A]">{t('analyzing.title')}</p>
                <p className="font-mono text-[9px] tracking-[1.2px] text-[#8A9099]">
                  {t('analyzing.processing').replace('{count}', smartwatchData.length.toString())}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Validation Warnings */}
        {validationWarnings.length > 0 && step > 0 && (
          <div className="px-3 sm:px-4 space-y-2">
            {validationWarnings.map((warning, index) => (
              <ValidationWarning key={index} message={warning} />
            ))}
          </div>
        )}

        {/* STEP 0: Brand On-Brand Design */}
        {step === 0 && !isAnalyzing && (
          <div id="step-0-content" key="step-0" className="animate-in fade-in duration-300 pb-10">

            {/* Hero headline */}
            <div className="px-5 pt-8">
              <p className="font-mono text-[9px] tracking-[2.2px] text-[#8A9099] uppercase mb-3">
                For your next personal best
              </p>
              <h1 className="font-display font-semibold text-[58px] leading-[0.92] tracking-tight uppercase text-[#0A0A0A]">
                Your<br/>
                <span className="text-[#CBD0D6]">Personalized</span><br/>
                Fuel Plan.
              </h1>
              <p className="text-[14px] leading-[1.5] text-[#2E2E2E] mt-4 max-w-xs">
                A personalised hydration + carb protocol built from your Strava data.
              </p>
            </div>

            {/* Silver stat band */}
            <div className="grid grid-cols-3 bg-[#CBD0D6] mt-7">
              {[['32g','Carbs/gel'],['90s','Build time'],['500mg','Sodium/dose']].map(([n,l],i)=>(
                <div key={i} className={`px-3 py-3.5 ${i>0?'border-l border-black/10':''}`}>
                  <div className="font-display font-bold text-[28px] leading-none tracking-tight tabular-nums text-[#0A0A0A]">{n}</div>
                  <div className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#0A0A0A]/55 mt-1">{l}</div>
                </div>
              ))}
            </div>

            {/* Connect section */}
            <div className="px-5 mt-7">
              <div className="flex justify-between font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase mb-2.5">
                <span>01 / Connect</span>
                <span>3 steps</span>
              </div>

              {/* Strava CTA */}
              <button
                type="button"
                className="w-full bg-[#FC4C02] text-white px-4 py-4 flex justify-between items-center"
                onClick={() => {
                  setDataSource('strava');
                  if (!stravaSnapshot) document.getElementById('strava-connect-trigger')?.click();
                }}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="white">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM7.298 10.172h3.066L12 5.492l1.636 4.68h3.066L12 0z"/>
                  </svg>
                  <div>
                    <div className="font-mono text-[9px] tracking-[1.5px] uppercase opacity-50">
                      {stravaSnapshot ? 'Connected' : 'Recommended'}
                    </div>
                    <div className="font-display font-semibold text-[20px] uppercase tracking-wide whitespace-nowrap">
                      {stravaSnapshot ? 'Continue with Strava' : 'Continue with Strava'}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[10px] opacity-50 shrink-0 ml-3">{stravaSnapshot ? '✓' : '→'}</span>
              </button>

              {/* Secondary options */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button
                  type="button"
                  className={`border py-3.5 px-4 font-mono text-[10px] tracking-[1.5px] uppercase transition-colors flex items-center justify-center gap-2 ${dataSource === 'manual' && smartwatchData.length > 0 ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white' : 'border-black/20 bg-white text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F7F8F9]'}`}
                  onClick={() => {
                    setDataSource('manual');
                    document.getElementById('smartwatch-files')?.click();
                  }}
                >
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="currentColor"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z"/></svg>
                  Upload .FIT
                </button>
                <button
                  type="button"
                  className={`border py-3.5 px-4 font-mono text-[10px] tracking-[1.5px] uppercase transition-colors flex items-center justify-center gap-2 ${dataSource === 'manual' && smartwatchData.length === 0 ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white' : 'border-black/20 bg-white text-[#0A0A0A] hover:border-[#0A0A0A] hover:bg-[#F7F8F9]'}`}
                  onClick={() => setDataSource('manual')}
                >
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 shrink-0" fill="currentColor"><path d="M12.854.146a.5.5 0 0 0-.707 0L10.5 1.793 14.207 5.5l1.647-1.646a.5.5 0 0 0 0-.708l-3-3zm.646 6.061L9.793 2.5 3.293 9H3.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.207l6.5-6.5zm-7.468 7.468A.5.5 0 0 1 6 13.5V13h-.5a.5.5 0 0 1-.5-.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.5-.5V10h-.5a.499.499 0 0 1-.175-.032l-.179.178a.5.5 0 0 0-.11.168l-2 5a.5.5 0 0 0 .65.65l5-2a.5.5 0 0 0 .168-.11l.178-.178z"/></svg>
                  Enter manually
                </button>
              </div>
            </div>

            {/* Strava connected — data preview */}
            {stravaSnapshot && (
              <div className="mt-7 px-5">
                <p className="font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase mb-2.5">
                  Pulled from Strava
                </p>
                <div className="border border-black/10">
                  {[
                    ['Weight & sex','PROFILE'],
                    ['Resting HR / zones','HRV'],
                    ['Training load', profile.sessionDuration ? `~${Math.round(profile.sessionDuration*10)/10}h avg` : '—'],
                    ['Typical pace', profile.runPace || profile.avgPace || '—'],
                  ].map(([k,v],i)=>(
                    <div key={i} className={`flex justify-between items-center px-3.5 py-3 ${i?'border-t border-black/10':''}`}>
                      <span className="text-[13.5px] font-medium text-[#0A0A0A]">{k}</span>
                      <span className="font-mono text-[9px] text-[#8A9099] tracking-[1.2px] whitespace-nowrap">{v}</span>
                    </div>
                  ))}
                </div>

                {/* Age field — Strava doesn't share DOB */}
                <div className={`mt-3 border p-3.5 ${profile.age ? 'border-black/10' : 'border-orange-300 bg-orange-50'}`}>
                  {!profile.age && (
                    <p className="font-mono text-[9px] tracking-[1.2px] text-orange-600 uppercase mb-2">{t('strava.ageRequired')}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[9px] tracking-[1.2px] text-[#8A9099] uppercase shrink-0">Born in</span>
                    <input
                      id="strava-birth-year"
                      type="number"
                      min={1920}
                      max={new Date().getFullYear() - 10}
                      placeholder="1990"
                      className="w-24 border border-black/10 px-2 py-1 font-mono text-[11px] bg-white focus:outline-none focus:border-black/30"
                      value={stravaBirthYearInput}
                      onChange={(e) => {
                        setStravaBirthYearInput(e.target.value);
                        const year = parseInt(e.target.value, 10);
                        if (year >= 1920 && year <= new Date().getFullYear() - 10) {
                          updateProfile({ age: new Date().getFullYear() - year });
                        }
                      }}
                    />
                    {profile.age && (
                      <span className="font-mono text-[9px] text-[#8A9099]">Age: {profile.age}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Manual entry body fields */}
            {dataSource === 'manual' && !stravaSnapshot && (
              <div className="mt-7 px-5">
                <p className="font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase mb-2.5">Your body data</p>
                <div className="border border-black/10 divide-y divide-black/10">
                  {/* Age */}
                  <div className="flex justify-between items-center px-3.5 py-3">
                    <span className="text-[13.5px] font-medium">Year of birth</span>
                    <input
                      type="number" min={1920} max={new Date().getFullYear()-10} placeholder="1990"
                      className="w-24 border border-black/10 px-2 py-1 font-mono text-[11px] bg-white text-right focus:outline-none focus:border-black/30"
                      value={stravaBirthYearInput}
                      onChange={(e) => {
                        setStravaBirthYearInput(e.target.value);
                        const year = parseInt(e.target.value,10);
                        if (year>=1920 && year<=new Date().getFullYear()-10) updateProfile({ age: new Date().getFullYear()-year });
                      }}
                    />
                  </div>
                  {/* Sex */}
                  <div className="flex justify-between items-center px-3.5 py-3">
                    <span className="text-[13.5px] font-medium">Sex</span>
                    <div className="flex gap-px bg-black/10">
                      {(['male','female'] as ('male'|'female')[]).map(s=>(
                        <button key={s} type="button"
                          onClick={()=>updateProfile({ sex: s })}
                          className={`px-3 py-1 font-mono text-[9px] tracking-[1.2px] uppercase ${profile.sex===s?'bg-[#0A0A0A] text-white':'bg-white text-[#0A0A0A]'}`}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                  {/* Weight */}
                  <div className="flex justify-between items-center px-3.5 py-3">
                    <span className="text-[13.5px] font-medium">Weight (kg)</span>
                    <input
                      type="number" min={30} max={200} placeholder="70"
                      className="w-20 border border-black/10 px-2 py-1 font-mono text-[11px] bg-white text-right focus:outline-none focus:border-black/30"
                      value={profile.weight || ''}
                      onChange={(e)=>updateProfile({ weight: parseFloat(e.target.value)||undefined })}
                    />
                  </div>
                  {/* Height */}
                  <div className="flex justify-between items-center px-3.5 py-3">
                    <span className="text-[13.5px] font-medium">Height (cm)</span>
                    <input
                      type="number" min={100} max={250} placeholder="175"
                      className="w-20 border border-black/10 px-2 py-1 font-mono text-[11px] bg-white text-right focus:outline-none focus:border-black/30"
                      value={profile.height || ''}
                      onChange={(e)=>updateProfile({ height: parseFloat(e.target.value)||undefined })}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* GDPR consent */}
            <div className="mt-7 px-5">
              <p className="font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase mb-3">Data & Consent</p>
              <div className="border border-black/10 p-4 space-y-4">
                {/* Accept all */}
                <button
                  type="button"
                  onClick={() => { setConsentGiven(true); setHealthConsentGiven(true); setAlgorithmConsentGiven(true); }}
                  className="w-full border border-[#0A0A0A] py-2.5 font-mono text-[10px] tracking-[1.5px] uppercase text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors"
                >
                  Accept all
                </button>
                {/* Main consent */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={consentGiven}
                    onChange={(e) => setConsentGiven(e.target.checked)}
                    className="mt-0.5 shrink-0 accent-[#0A0A0A]"
                  />
                  <span className="text-[12px] text-[#2E2E2E] leading-relaxed">
                    I consent to Supplme processing my personal data (age, sex, weight, height, training history) for the purpose of generating a personalised fuel plan, in accordance with the{' '}
                    <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline text-[#0A0A0A]">Privacy Policy</a>.
                    I understand I can withdraw consent and request deletion of my data at any time.
                  </span>
                </label>
                {/* Health data — Article 9 explicit consent */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={healthConsentGiven}
                    onChange={(e) => { setHealthConsentGiven(e.target.checked); setAlgorithmConsentGiven(e.target.checked); }}
                    className="mt-0.5 shrink-0 accent-[#0A0A0A]"
                  />
                  <span className="text-[12px] text-[#2E2E2E] leading-relaxed">
                    I explicitly consent to the processing of my health-related data (sweat rate, dietary habits, physiological indicators) as special category data under GDPR Article 9, solely to calculate my fuel and hydration protocol. This data is never sold or shared with third parties.
                  </span>
                </label>
              </div>
            </div>

            {/* Footer proof */}
            <div className="px-5 mt-6 flex items-center justify-between">
              <span className="font-mono text-[9px] text-[#8A9099] tracking-[1.4px] uppercase">Informed Sport Certified</span>
              <span className="font-mono text-[9px] text-[#8A9099] tracking-[1.4px] uppercase">No Account</span>
            </div>

            {/* Step 0 CTA — proceed to questionnaire */}
            <div className="px-5 mt-6">
              <button
                type="button"
                onClick={handleNextStep}
                disabled={!isStepValid()}
                className="w-full bg-[#0A0A0A] text-white px-4 py-4 flex justify-between items-center disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="font-display font-semibold text-[18px] uppercase tracking-wide">
                  {dataSource === 'strava' && stravaSnapshot ? 'Build my plan' : dataSource === 'manual' ? 'Continue' : 'Get started'}
                </span>
                <span className="font-mono text-[10px] opacity-55 tracking-[1px]">STEP 1 OF 3 →</span>
              </button>
            </div>

          </div>
        )}

        {/* Hidden OAuth triggers — always rendered, hidden via CSS */}
        <div className="hidden" aria-hidden="true">
          <button
            id="strava-connect-trigger"
            type="button"
            onClick={handleStravaOAuthClick}
          />
          <button
            id="garmin-connect-trigger"
            type="button"
            onClick={() => { handleGarminOAuthClick(); }}
          />
          <input
            id="smartwatch-files"
            type="file"
            multiple
            accept=".fit,.csv,.json,.xml,.txt"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) setSmartWatchData(prev => [...prev, ...files]);
              e.target.value = '';
            }}
            className="sr-only"
            aria-label={t('upload.title')}
          />
          <input
            type="file"
            id="smartwatch-folder"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) setSmartWatchData(files);
              e.target.value = '';
            }}
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            aria-hidden="true"
          />
        </div>


        {/* STEP 1: Activity & Race + Environment */}
        {step === 1 && !isAnalyzing && (
          <div id="step-1-content" key="step-1-activity" className="animate-in fade-in duration-300">
            <QuestionnaireStep
              title="Activity & Race"
              description="Select your sport, find your race, and set conditions"
              onNext={handleNextStep}
              onBack={() => handleBackStep(0)}
              isValid={isStepValid()}
            >
              <ActivityRaceSelector
                profile={profile}
                onUpdateProfile={updateProfile}
                onApplyRace={applyRaceToProfile}
              />
            </QuestionnaireStep>
          </div>
        )}

        {/* STEP 2: Sweat Profile */}
        {step === 2 && !isAnalyzing && (
          <div key="step-2-sweat" className="animate-in fade-in duration-300">
          <QuestionnaireStep
            title="Sweat Profile"
            description={analyzedData ? t('step4.descriptionAnalyzed') : t('step4.description')}
            onNext={handleNextStep}
            onBack={() => handleBackStep(1)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">{t('sweat.howToTitle')}</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>{t('sweat.rate')}:</strong> {t('sweat.sweatRateHowTo')}</p>
                  <p><strong>{t('sweat.saltiness')}:</strong> {t('sweat.saltinessHowTo')}</p>
                  <p className="text-xs pt-2">{t('sweat.foundIn')}</p>
                </div>
              </div>
              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('sweat.rate')} *</Label>
                  <InfoTooltip content={t('sweat.rateTooltip')} />
                </div>
                {analyzedData?.sweatRate && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                    {t('sweat.fromSmartwatch')}
                  </p>
                )}
                <RadioGroup
                  value={profile.sweatRate || ''}
                  onValueChange={(value) => updateProfile({ sweatRate: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="sweat-low" />
                    <Label htmlFor="sweat-low" className="font-normal">{t('sweat.low')} ({t('sweat.minimalSweating')})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="sweat-medium" />
                    <Label htmlFor="sweat-medium" className="font-normal">{t('sweat.medium')} ({t('sweat.moderateSweating')})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="sweat-high" />
                    <Label htmlFor="sweat-high" className="font-normal">{t('sweat.high')} ({t('sweat.heavySweating')})</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('sweat.saltiness')} *</Label>
                  <InfoTooltip content={t('sweat.saltinessTooltip')} />
                </div>
                {analyzedData?.sweatSaltiness && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                    {t('sweat.fromSmartwatch')}
                  </p>
                )}
                <RadioGroup
                  value={profile.sweatSaltiness || ''}
                  onValueChange={(value) => updateProfile({ sweatSaltiness: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="salt-low" />
                    <Label htmlFor="salt-low" className="font-normal">{t('sweat.low')} ({t('sweat.noResidue')})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="salt-medium" />
                    <Label htmlFor="salt-medium" className="font-normal">{t('sweat.medium')} ({t('sweat.someResidue')})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="salt-high" />
                    <Label htmlFor="salt-high" className="font-normal">{t('sweat.high')} ({t('sweat.significantResidue')})</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label htmlFor="knownSodiumLossPerHour">{t('sweat.knownSodiumLossLabel')}</Label>
                  <InfoTooltip content={t('sweat.knownSodiumLossTooltip')} />
                </div>
                <Input
                  id="knownSodiumLossPerHour"
                  type="number"
                  min={200}
                  max={2000}
                  step={50}
                  placeholder={t('sweat.knownSodiumLossPlaceholder')}
                  value={profile.knownSodiumLossPerHour ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '') {
                      updateProfile({ knownSodiumLossPerHour: undefined });
                      return;
                    }
                    const n = parseFloat(v);
                    if (!Number.isNaN(n) && n >= 0) updateProfile({ knownSodiumLossPerHour: n });
                  }}
                  className="max-w-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">{t('sweat.knownSodiumLossHint')}</p>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('sweat.cramping')}</Label>
                  <InfoTooltip content={t('sweat.crampingTooltip')} />
                </div>
                <RadioGroup
                  value={profile.crampTiming || 'none'}
                  onValueChange={(value) => updateProfile({ crampTiming: value as 'none' | 'early' | 'mid' | 'late' | 'post' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="cramp-none" />
                    <Label htmlFor="cramp-none" className="font-normal">{t('sweat.none')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="early" id="cramp-early" />
                    <Label htmlFor="cramp-early" className="font-normal">{t('sweat.early')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mid" id="cramp-mid" />
                    <Label htmlFor="cramp-mid" className="font-normal">{t('sweat.mid')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="late" id="cramp-late" />
                    <Label htmlFor="cramp-late" className="font-normal">{t('sweat.late')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="post" id="cramp-post" />
                    <Label htmlFor="cramp-post" className="font-normal">{t('sweat.post')}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="hydrationStrategy">{t('sweat.hydrationStrategyLabel')}</Label>
                <Textarea
                  id="hydrationStrategy"
                  value={profile.hydrationStrategy || ''}
                  onChange={(e) => updateProfile({ hydrationStrategy: e.target.value })}
                  placeholder={t('sweat.hydrationStrategyPlaceholder')}
                  rows={3}
                />
              </div>
            </div>
          </QuestionnaireStep>
          </div>
        )}

        {/* STEP 3: Dietary Habits */}
        {step === 3 && !isAnalyzing && (
          <div key="step-3-diet" className="animate-in fade-in duration-300">
          <QuestionnaireStep
            title="Dietary Habits"
            description="Your daily nutrition affects electrolyte needs"
            onNext={handleComplete}
            onBack={() => handleBackStep(2)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('nutrition.saltIntake')} *</Label>
                  <InfoTooltip content="Low: minimal processed foods, no added salt. Medium: normal diet with some salt. High: salty foods regularly, add salt to meals." />
                </div>
                <RadioGroup
                  value={profile.dailySaltIntake || ''}
                  onValueChange={(value) => updateProfile({ dailySaltIntake: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="salt-intake-low" />
                    <Label htmlFor="salt-intake-low" className="font-normal">{t('sweat.low')} ({t('nutrition.saltLowLabel')})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="salt-intake-medium" />
                    <Label htmlFor="salt-intake-medium" className="font-normal">{t('sweat.medium')} ({t('nutrition.saltMediumLabel')})</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="salt-intake-high" />
                    <Label htmlFor="salt-intake-high" className="font-normal">{t('sweat.high')} ({t('nutrition.saltHighLabel')})</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="dailyWaterIntake">{t('nutrition.waterIntake')}</Label>
                <Input
                  id="dailyWaterIntake"
                  type="number"
                  step="0.5"
                  value={profile.dailyWaterIntake || ''}
                  onChange={(e) => updateProfile({ dailyWaterIntake: parseFloat(e.target.value) })}
                  placeholder={t('nutrition.waterPlaceholder')}
                />
              </div>

              <div>
                <div className="flex items-center">
                  <Label htmlFor="caffeineIntake">{t('nutrition.caffeine')}</Label>
                  <InfoTooltip content="Caffeine can have a mild diuretic effect at high doses (>300mg/day). 1 cup coffee ≈ 95mg, 1 espresso ≈ 64mg, 1 energy drink ≈ 80mg." />
                </div>
                <Input
                  id="caffeineIntake"
                  type="number"
                  value={profile.caffeineIntake || ''}
                  onChange={(e) => updateProfile({ caffeineIntake: parseInt(e.target.value) })}
                  placeholder={t('nutrition.caffeinePlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="dietType">{t('nutrition.diet')}</Label>
                <Input
                  id="dietType"
                  value={profile.dietType || ''}
                  onChange={(e) => updateProfile({ dietType: e.target.value })}
                  placeholder={t('nutrition.dietPlaceholder')}
                />
              </div>

              <div>
                <Label htmlFor="nutritionNotes">{t('nutrition.notesLabel')}</Label>
                <Textarea
                  id="nutritionNotes"
                  value={profile.nutritionNotes || ''}
                  onChange={(e) => updateProfile({ nutritionNotes: e.target.value })}
                  placeholder={t('nutrition.notesPlaceholder')}
                  rows={3}
                />
              </div>
            </div>
          </QuestionnaireStep>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
