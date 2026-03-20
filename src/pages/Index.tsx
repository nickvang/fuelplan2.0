import { useState, useEffect, useRef, useCallback } from 'react';
import { HydrationProfile } from '@/types/hydration';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { validateAndSanitizeProfile } from '@/utils/profileValidation';
import { parseSmartWatchFiles } from '@/utils/garminDataParser';
import { calculateTriathlonDuration, getTriathlonBreakdown, TRIATHLON_DISTANCES, T1_DURATION, T2_DURATION } from '@/utils/triathlonCalculator';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import { HydrationPlanDisplay } from '@/components/HydrationPlanDisplay';
import { InfoTooltip } from '@/components/InfoTooltip';
import { ValidationWarning, getValidationWarnings } from '@/components/ValidationWarning';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PaceDurationCalculator } from '@/components/PaceDurationCalculator';
import { DataSourceSelector, DataSource } from '@/components/DataSourceSelector';
import { ActivityRaceSelector } from '@/components/ActivityRaceSelector';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { ArrowRight, ListOrdered } from 'lucide-react';
import supplmeLogo from '@/assets/supplme-logo-sort.svg';
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
  const { selectedRace, setSelectedRace } = useRace();
  const [version, setVersion] = useState<'pro' | null>('pro'); // Single flow (no Quick/Pro choice)
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [step, setStep] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false); // GDPR: explicit opt-in required
  const [smartwatchData, setSmartWatchData] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<Partial<HydrationProfile> | null>(null);
  const [rawSmartWatchData, setRawSmartWatchData] = useState<any>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState(''); // Bot protection
  const [stravaSnapshot, setStravaSnapshot] = useState<{ athlete: unknown; activities: unknown[] } | null>(null);
  const [garminSnapshot, setGarminSnapshot] = useState<{ userId: string; permissions?: string[] } | null>(null);
  const [garminConnectionId, setGarminConnectionId] = useState<string | null>(null);
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
        const prefillKeys = ['fullName', 'age', 'sex', 'height', 'weight', 'restingHeartRate', 'sessionDuration', 'indoorOutdoor'] as const;
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
      toast.error(detail || t('strava.error'));
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
      if (e.data?.type === 'strava-error') {
        toast.error(e.data.message || t('strava.error'));
      }
      if (e.data?.type === 'garmin-connected') {
        applyGarminPrefill();
      }
      if (e.data?.type === 'garmin-error') {
        toast.error(e.data.message || t('garmin.error'));
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
      toast.error(detail || t('garmin.error'));
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

  // Persist key body data in localStorage so returning users are pre-filled
  useEffect(() => {
    try {
      const raw = localStorage.getItem('supplme_profile_body');
      if (raw) {
        const saved = JSON.parse(raw);
        setProfile((prev) => ({ ...prev, ...saved }));
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
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
    if (hasValues) {
      try {
        localStorage.setItem('supplme_profile_body', JSON.stringify(bodySnapshot));
      } catch {
        // ignore storage errors
      }
    }
  }, [profile.fullName, profile.age, profile.sex, profile.height, profile.weight, profile.bodyFat, profile.restingHeartRate, profile.hrv, profile.sleepHours, profile.sleepQuality]);

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

    // Estimate session duration from distance if not already set
    let estimatedDuration: Partial<HydrationProfile> = {};
    if (!profile.sessionDuration && race.distance_km) {
      let estimatedHours: number | undefined;
      const primaryDiscipline = profile.disciplines?.[0] || '';
      if (primaryDiscipline === 'Running') {
        const paceMinPerKm = 5.5; // default moderate race pace
        estimatedHours = (race.distance_km * paceMinPerKm) / 60;
      } else if (primaryDiscipline === 'Cycling') {
        const speedKmh = 28; // moderate gran fondo speed
        estimatedHours = race.distance_km / speedKmh;
      }
      if (estimatedHours && isFinite(estimatedHours)) {
        estimatedDuration = { sessionDuration: estimatedHours };
      }
    }

    updateProfile({
      hasUpcomingRace: true,
      upcomingEvents: race.name,
      raceDistance: distanceLabel,
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
      toast.error('Error analyzing smartwatch data');
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
        if (!consentGiven) return false;
        if (dataSource === 'strava') return !!stravaSnapshot;
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
        toast.error('Spam detected. Please try again.');
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
        if (completeProfile.age == null) completeProfile.age = 30;
        if (completeProfile.height == null) completeProfile.height = 175;
        if (!completeProfile.raceDistance && completeProfile.disciplines?.[0]) completeProfile.raceDistance = 'Other';
      }

      try {
        // Validate and sanitize profile data before submission
        const validatedProfile = validateAndSanitizeProfile(completeProfile);
        const profileToSave = { ...validatedProfile, ...(stravaSnapshot && { strava_snapshot: stravaSnapshot }), ...(garminSnapshot && { garmin_snapshot: garminSnapshot }) };

        // Save profile data to backend with GDPR compliance
        const { data, error } = await supabase.functions.invoke('save-hydration-profile', {
          body: {
            profile: profileToSave,
            plan: calculateHydrationPlan(completeProfile as HydrationProfile),
            hasSmartWatchData: !!analyzedData && smartwatchData.length > 0,
            consentGiven,
            userEmail: null // Optional: could add email field for users who want to save
          }
        });

        if (error) {
          if (import.meta.env.DEV) {
            console.error('Error saving profile:', error);
          }
          toast.error('Failed to save profile. Your hydration plan will still be displayed.');
        } else if (data?.deletionToken) {
          // Store deletion token securely in localStorage for GDPR data deletion
          localStorage.setItem('hydration_deletion_token', data.deletionToken);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to save profile:', error);
        }

        // Show validation error to user
        if (error instanceof Error) {
          toast.error(error.message);
          setIsGenerating(false);
          return; // Don't show plan if validation fails
        }

        toast.error('Failed to save profile. Your hydration plan will still be displayed.');
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
    setDataSource(null);
    setStep(0);
    setShowPlan(false);
    setIsGenerating(false);
    setConsentGiven(false);
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
      raceDistance: 'Marathon',
      sessionDuration: 3.5,
      hasUpcomingRace: true,
      upcomingEvents: 'Marathon',
      age: 35,
      sex: 'male',
      height: 178,
      weight: 72,
      trainingTempRange: { min: 15, max: 22 },
      humidity: 50,
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

  console.log('[Index] render path: isGenerating=', isGenerating, 'showPlan=', showPlan, 'step=', step);

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
    const plan = calculateHydrationPlan(profile as HydrationProfile, rawSmartWatchData);
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
    <div className="min-h-screen min-w-0 bg-background relative overflow-x-hidden pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-12 px-3 sm:px-4">
      {/* Athletic background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, currentColor 35px, currentColor 36px)',
        }}></div>
      </div>

      <div className="max-w-2xl mx-auto min-w-0 space-y-6 sm:space-y-8 relative z-10">
        {/* Header - Shows on all steps */}
        <div className="text-center">
          <div className="flex justify-end items-center gap-2 mb-2">
            {import.meta.env.DEV && step === 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={goToMarathonResultsDev}
              >
                Dev: Marathon results
              </Button>
            )}
            <LanguageSwitcher />
          </div>
          <img src={supplmeLogo} alt="Supplme" className="h-24 sm:h-32 mx-auto max-w-full" />
          <div className="space-y-1 mt-3 px-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              {t('app.title')}
            </h1>
            {step === 0 && (
              <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                {t('app.subtitle')}
              </p>
            )}
          </div>

        </div>

        {/* Honeypot field - hidden from real users, visible to bots */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
          }}
          aria-hidden="true"
        />

        {/* Progress - simplified 3-step UX layer */}
        {!isAnalyzing && (
          <ProgressBar currentStep={uiStep} totalSteps={uiTotalSteps} />
        )}

        {/* Analyzing Indicator */}
        {isAnalyzing && (
          <div id="generating-view" className="athletic-card bg-primary/5 border-primary/20 rounded-xl p-6 animate-fade-in">
            <div className="flex items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-primary border-t-transparent shimmer"></div>
              <div className="space-y-1">
                <p className="font-bold text-lg text-primary uppercase tracking-wide">{t('analyzing.title')}</p>
                <p className="text-sm text-muted-foreground font-medium">
                  {t('analyzing.processing').replace('{count}', smartwatchData.length.toString())}
                </p>
              </div>
            </div>
          </div>
        )}


        {/* Validation Warnings */}
        {validationWarnings.length > 0 && step > 0 && (
          <div className="space-y-2">
            {validationWarnings.map((warning, index) => (
              <ValidationWarning key={index} message={warning} />
            ))}
          </div>
        )}

        {/* STEP 0: Data Source Selection */}
        {step === 0 && !isAnalyzing && (
          <div id="step-0-content" key="step-0" className="animate-in fade-in duration-300 space-y-4">
            <div className="py-2 sm:py-4 space-y-4">
              <DataSourceSelector
                selectedSource={dataSource}
                onSelectSource={(source) => {
                  setDataSource(source);
                  if (source === 'strava' && !stravaSnapshot) {
                    document.getElementById('strava-connect-trigger')?.click();
                  } else if (source === 'garmin' && !garminSnapshot) {
                    document.getElementById('garmin-connect-trigger')?.click();
                  }
                }}
                consentGiven={consentGiven}
                onConsentChange={(consent) => setConsentGiven(consent)}
                stravaConnected={!!stravaSnapshot}
                garminConnected={!!garminSnapshot}
                onStravaConnect={() => document.getElementById('strava-connect-trigger')?.click()}
                onGarminConnect={() => document.getElementById('garmin-connect-trigger')?.click()}
                hasStravaConfig={!!import.meta.env.VITE_STRAVA_CLIENT_ID}
                hasGarminConfig={!!import.meta.env.VITE_GARMIN_CLIENT_ID}
                smartwatchFiles={smartwatchData}
                onSmartWatchFilesChange={setSmartWatchData}
                profile={profile}
                onUpdateProfile={updateProfile}
              />

              {/* Hidden OAuth triggers - preserves existing Strava/Garmin OAuth popup logic */}
              <div className="hidden">
              <div className="bg-muted/40 p-3 sm:p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex-shrink-0 w-7 h-7 rounded-md bg-[#FC4C02] flex items-center justify-center" aria-hidden>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" role="img" aria-label="Strava">
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116h-5.002zM12 0L7.298 10.172h3.066L12 5.492l1.636 4.68h3.066L12 0z" />
                    </svg>
                  </span>
                  <p className="text-xs sm:text-sm font-medium text-foreground">
                    {t('strava.title')} <span className="text-muted-foreground">({t('common.optional')})</span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{t('strava.description')}</p>
                {(() => {
                  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
                  const redirectBase =
                    typeof window !== 'undefined'
                      ? (window.location.hostname.endsWith('supplme.app') ? 'https://supplme.app' : window.location.origin)
                      : '';
                  const redirectUri = redirectBase ? `${redirectBase}/strava-callback` : '';
                  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  const hasStravaConfig = !!clientId && !!redirectUri;

                  return hasStravaConfig ? (
                    <Button
                      id="strava-connect-trigger"
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto border-orange-500/50 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/70"
                      onClick={() => {
                        const state = generateStravaState();

                        // Store state in both sessionStorage and localStorage
                        // sessionStorage is per-window, so popups can't read it — localStorage is needed for desktop popup flow too
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

                        if (isMobile) {
                          // MOBILE: Strava's Universal Link endpoint (opens app if allowed)
                          const mobileUrl = `https://www.strava.com/oauth/mobile/authorize?${params.toString()}`;
                          window.location.href = mobileUrl;
                          return;
                        }

                        // DESKTOP: web OAuth in popup with fallback
                        const webUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
                        const width = 500;
                        const height = 600;
                        const left = Math.round((window.screen.width - width) / 2);
                        const top = Math.round((window.screen.height - height) / 2);

                        const popup = window.open(
                          webUrl,
                          'strava-auth',
                          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
                        );

                        if (!popup) {
                          toast.info(t('strava.popupFallback'));
                          window.location.href = webUrl;
                          return;
                        }

                        sessionStorage.setItem('strava_use_popup', '1');
                        const startTime = Date.now();
                        const POPUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
                        if (stravaPollRef.current) clearInterval(stravaPollRef.current);
                        stravaPollRef.current = setInterval(() => {
                          if (popup.closed) {
                            clearInterval(stravaPollRef.current!);
                            stravaPollRef.current = null;
                            sessionStorage.removeItem('strava_use_popup');
                            if (sessionStorage.getItem(STRAVA_PREFILL_KEY)) {
                              applyStravaPrefill();
                            } else {
                              // Check for error stored by StravaCallback
                              const errMsg = sessionStorage.getItem(STRAVA_ERROR_KEY) || localStorage.getItem(STRAVA_ERROR_KEY);
                              sessionStorage.removeItem(STRAVA_ERROR_KEY);
                              localStorage.removeItem(STRAVA_ERROR_KEY);
                              if (errMsg) {
                                toast.error(errMsg);
                              }
                            }
                          } else if (Date.now() - startTime > POPUP_TIMEOUT_MS) {
                            clearInterval(stravaPollRef.current!);
                            stravaPollRef.current = null;
                            sessionStorage.removeItem('strava_use_popup');
                            popup.close();
                            toast.error('Strava connection timed out. Please try again.');
                          }
                        }, 300);
                      }}
                    >
                      {stravaSnapshot ? t('strava.connected') : t('strava.connect')}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('strava.notConfigured')}</span>
                  );
                })()}
                {stravaSnapshot && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">{t('strava.connected')}</p>
                )}
              </div>

              {/* Card 2: Connect with Garmin */}
              <div className="bg-muted/40 p-3 sm:p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <span className="flex-shrink-0 w-7 h-7 rounded-md bg-[#007CC3] flex items-center justify-center" aria-hidden>
                    <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="currentColor" role="img" aria-label="Garmin">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                    </svg>
                  </span>
                  <p className="text-xs sm:text-sm font-medium text-foreground">
                    {t('garmin.title')} <span className="text-muted-foreground">({t('common.optional')})</span>
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{t('garmin.description')}</p>
                {(() => {
                  const garminClientId = import.meta.env.VITE_GARMIN_CLIENT_ID;
                  const redirectBase =
                    typeof window !== 'undefined'
                      ? (window.location.hostname.endsWith('supplme.app') ? 'https://supplme.app' : window.location.origin)
                      : '';
                  const garminRedirectUri = redirectBase ? `${redirectBase}/garmin-callback` : '';
                  const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                  const hasGarminConfig = !!garminClientId && !!garminRedirectUri;

                  return hasGarminConfig ? (
                    <Button
                      id="garmin-connect-trigger"
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/70"
                      onClick={async () => {
                        const state = generateStravaState();
                        const { verifier, challenge } = await generatePKCE();

                        sessionStorage.setItem(GARMIN_STATE_KEY, state);
                        localStorage.setItem(GARMIN_STATE_KEY, JSON.stringify({ state, ts: Date.now() }));
                        // Store code_verifier in localStorage (survives popup boundary)
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

                        if (isMobile) {
                          window.location.href = authUrl;
                          return;
                        }

                        const width = 500;
                        const height = 600;
                        const left = Math.round((window.screen.width - width) / 2);
                        const top = Math.round((window.screen.height - height) / 2);

                        const popup = window.open(
                          authUrl,
                          'garmin-auth',
                          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
                        );

                        if (!popup) {
                          toast.info(t('garmin.popupFallback'));
                          window.location.href = authUrl;
                          return;
                        }

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
                              if (errMsg) {
                                toast.error(errMsg);
                              }
                            }
                          } else if (Date.now() - startTime > POPUP_TIMEOUT_MS) {
                            clearInterval(garminPollRef.current!);
                            garminPollRef.current = null;
                            sessionStorage.removeItem('garmin_use_popup');
                            popup.close();
                            toast.error('Garmin connection timed out. Please try again.');
                          }
                        }, 300);
                      }}
                    >
                      {garminSnapshot ? t('garmin.connected') : t('garmin.connect')}
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">{t('garmin.notConfigured')}</span>
                  );
                })()}
                {garminSnapshot && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2 font-medium">{t('garmin.connected')}</p>
                )}
              </div>

              {/* Card 3: Upload Smartwatch Data */}
              <div className="bg-muted/40 p-3 sm:p-4 rounded-xl">
                <Label htmlFor="smartwatch-files" className="text-xs sm:text-sm font-medium">
                  {t('upload.title')} <span className="text-muted-foreground">({t('common.optional')})</span>
                </Label>
                <p className="text-xs text-muted-foreground mt-1">{t('upload.description')}</p>
                <div className="mt-2 space-y-2">
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
                  <label
                    htmlFor="smartwatch-files"
                    className="flex items-center justify-between gap-4 min-h-[48px] px-4 py-3 rounded-lg border-2 border-border/50 bg-background cursor-pointer hover:border-border focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-colors"
                  >
                    <span className="text-sm font-medium text-foreground shrink-0">{t('smartwatch.chooseFiles')}</span>
                    <span className="text-sm text-muted-foreground truncate text-right">
                      {smartwatchData.length > 0 ? t('smartwatch.filesChosen').replace('{count}', smartwatchData.length.toString()) : t('smartwatch.noFileChosen')}
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-9 border-border/50"
                    onClick={() => document.getElementById('smartwatch-folder')?.click()}
                  >
                    {t('smartwatch.uploadFolder')}
                  </Button>
                  <input
                    type="file"
                    id="smartwatch-folder"
                    // @ts-expect-error webkitdirectory
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) setSmartWatchData(files);
                      e.target.value = '';
                    }}
                    className="absolute opacity-0 w-0 h-0 pointer-events-none"
                    aria-hidden
                  />
                </div>
                {smartwatchData.length > 0 && (
                  <p className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-2 font-medium flex flex-wrap items-center gap-2">
                    {t('smartwatch.uploaded').replace('{count}', smartwatchData.length.toString())}
                    <button type="button" onClick={() => setSmartWatchData([])} className="py-2.5 px-4 min-h-[44px] inline-flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg border border-border/50 touch-manipulation">{t('smartwatch.remove')}</button>
                  </p>
                )}
                {/* Supported brands */}
                <div className="mt-4 pt-3 border-t border-border/60">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Works with</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {['Garmin', 'Coros', 'Whoop', 'Oura', 'Apple Watch'].map((brand) => (
                      <span key={brand} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0 text-muted-foreground/80" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="6" y="4" width="12" height="16" rx="2" ry="2" />
                          <path d="M12 8v4l2 2" />
                        </svg>
                        {brand}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 3: Activity – Step 1/3: Select Sport & Event */}
              <div className="bg-muted/40 p-3 sm:p-4 rounded-xl space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Step 1 of 3 · Select Sport & Event
                </p>
                <div>
                  <Label className="text-lg mb-4 block">{t('activity.primaryDiscipline')} *</Label>
                  <p className="text-sm text-muted-foreground mb-4">
                    {t('activity.selectGuide')}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { value: 'Running', label: 'Run', icon: '🏃' },
                      { value: 'Swimming', label: 'Swim', icon: '🏊' },
                      { value: 'Cycling', label: 'Bike', icon: '🚴' },
                      { value: 'Triathlon', label: 'Triathlon', icon: '🏅' },
                    ].map((activity) => (
                      <button
                        key={activity.value}
                        type="button"
                        onClick={() => updateProfile({ disciplines: [activity.value], terrain: undefined })}
                        className={`
                          group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105
                          ${profile.disciplines?.[0] === activity.value
                            ? 'border-primary bg-primary/10 shadow-xl shadow-primary/20 scale-105'
                            : 'border-border/50 hover:border-primary/50 hover:bg-muted/50 hover:shadow-lg'
                          }
                        `}
                      >
                        <span className="text-5xl mb-3 transition-transform group-hover:scale-110">{activity.icon}</span>
                        <span className={`text-sm font-bold uppercase tracking-wide transition-colors ${profile.disciplines?.[0] === activity.value ? 'text-primary' : 'text-foreground'
                          }`}>
                          {activity.label}
                        </span>
                        {profile.disciplines?.[0] === activity.value && (
                          <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                            <span className="text-primary-foreground text-sm font-bold">✓</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Terrain */}
                {profile.disciplines?.[0] && (
                  <div>
                    <Label>
                      {profile.disciplines?.[0] === 'Running' ? 'Running Terrain *' :
                        profile.disciplines?.[0] === 'Swimming' ? 'Swimming Environment *' :
                          profile.disciplines?.[0] === 'Cycling' ? 'Cycling Type *' :
                            profile.disciplines?.[0] === 'Triathlon' ? 'Primary Terrain *' :
                              'Terrain *'}
                    </Label>
                    <RadioGroup
                      value={profile.terrain || ''}
                      onValueChange={(value) => updateProfile({ terrain: value })}
                      className="mt-3 space-y-3"
                    >
                      {profile.disciplines?.[0] === 'Running' && (
                        <>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="road" id="terrain-road" />
                            <Label htmlFor="terrain-road" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Road</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="treadmill" id="terrain-treadmill" />
                            <Label htmlFor="terrain-treadmill" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Treadmill</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="trail" id="terrain-trail" />
                            <Label htmlFor="terrain-trail" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Trail</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="gravel" id="terrain-gravel" />
                            <Label htmlFor="terrain-gravel" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Gravel</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="track" id="terrain-track" />
                            <Label htmlFor="terrain-track" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Track</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="mixed" id="terrain-mixed" />
                            <Label htmlFor="terrain-mixed" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Mixed</Label>
                          </label>
                        </>
                      )}
                      {profile.disciplines?.[0] === 'Swimming' && (
                        <>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="indoor-pool" id="terrain-indoor-pool" />
                            <Label htmlFor="terrain-indoor-pool" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Indoor Pool</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="outdoor-pool" id="terrain-outdoor-pool" />
                            <Label htmlFor="terrain-outdoor-pool" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Outdoor Pool</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="ocean" id="terrain-ocean" />
                            <Label htmlFor="terrain-ocean" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Ocean/Sea</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="lake" id="terrain-lake" />
                            <Label htmlFor="terrain-lake" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Lake</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="river" id="terrain-river" />
                            <Label htmlFor="terrain-river" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">River</Label>
                          </label>
                        </>
                      )}
                      {profile.disciplines?.[0] === 'Cycling' && (
                        <>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="road-bike" id="terrain-road-bike" />
                            <Label htmlFor="terrain-road-bike" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Road Bike</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="mountain-bike" id="terrain-mountain-bike" />
                            <Label htmlFor="terrain-mountain-bike" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Mountain Bike</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="gravel-bike" id="terrain-gravel-bike" />
                            <Label htmlFor="terrain-gravel-bike" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Gravel Bike</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="cyclocross" id="terrain-cyclocross" />
                            <Label htmlFor="terrain-cyclocross" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Cyclocross</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="mixed-cycling" id="terrain-mixed-cycling" />
                            <Label htmlFor="terrain-mixed-cycling" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Mixed</Label>
                          </label>
                        </>
                      )}
                      {profile.disciplines?.[0] === 'Triathlon' && (
                        <>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="road-triathlon" id="terrain-road-triathlon" />
                            <Label htmlFor="terrain-road-triathlon" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Road Triathlon</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="off-road-triathlon" id="terrain-off-road-triathlon" />
                            <Label htmlFor="terrain-off-road-triathlon" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Off-Road/XTERRA</Label>
                          </label>
                          <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                            <RadioGroupItem value="mixed-triathlon" id="terrain-mixed-triathlon" />
                            <Label htmlFor="terrain-mixed-triathlon" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Mixed</Label>
                          </label>
                        </>
                      )}
                    </RadioGroup>
                  </div>
                )}

                {/* Race / Custom – Step 1: Enter race or choose custom */}
                <div className="relative p-5 border-2 rounded-xl transition-all duration-300 border-primary bg-primary/10 shadow-lg shadow-primary/20">
                  <div className="absolute -top-3 left-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                    ENTER RACE OR CUSTOM
                  </div>

                  {['Running', 'Cycling', 'Triathlon'].includes(profile.disciplines?.[0] || '') && (
                    <div className="space-y-3">
                      <RaceSelector
                        sport={
                          profile.disciplines?.[0] === 'Running'
                            ? 'running'
                            : profile.disciplines?.[0] === 'Cycling'
                            ? 'cycling'
                            : 'triathlon'
                        }
                        selectedRaceId={selectedRace?.id ?? null}
                        onSelectRace={applyRaceToProfile}
                      />
                    </div>
                  )}

                  {/* Custom event details (shown and editable for both certified and custom) */}
                  <div className="mt-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {selectedRace
                        ? 'You can still tweak any details below.'
                        : 'Custom event: enter your own details.'}
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="trainingDistance">
                        {profile.disciplines?.[0] === 'Triathlon'
                          ? 'Race type or distance (km) *'
                          : 'Training / race distance (km) *'}
                      </Label>
                      <Input
                        id="trainingDistance"
                        value={profile.raceDistance || ''}
                        onChange={(e) => updateProfile({ raceDistance: e.target.value })}
                        placeholder={
                          profile.disciplines?.[0] === 'Running'
                            ? 'e.g., 10km, Half Marathon, Marathon'
                            : profile.disciplines?.[0] === 'Cycling'
                            ? 'e.g., 40km, 100km, 160km'
                            : profile.disciplines?.[0] === 'Triathlon'
                            ? 'e.g., Sprint, 70.3, Ironman'
                            : 'e.g., 10km, 2h ride'
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="trainingGoalTime">Expected time (optional)</Label>
                      <Input
                        id="trainingGoalTime"
                        value={profile.goalTime || ''}
                        onChange={(e) => updateProfile({ goalTime: e.target.value })}
                        placeholder="e.g., 1:30:00"
                        className="bg-background text-foreground border-border placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="avgPace">
                        Pace (optional)
                      </Label>
                      <Input
                        id="avgPace"
                        value={profile.avgPace || ''}
                        onChange={(e) => updateProfile({ avgPace: e.target.value })}
                        placeholder={
                          profile.disciplines?.[0] === 'Running'
                            ? 'e.g., 5:15/km'
                            : profile.disciplines?.[0] === 'Cycling'
                            ? 'e.g., 30 km/h'
                            : 'e.g., 5:30/km'
                        }
                        className="bg-background text-foreground border-border placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="altitudeMeters">Altitude (m)</Label>
                        <Input
                          id="altitudeMeters"
                          type="number"
                          value={profile.altitudeMeters || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            const n = v === '' ? undefined : Number(v);
                            let altitude: HydrationProfile['altitude'] = 'sea-level';
                            if (typeof n === 'number' && !Number.isNaN(n)) {
                              if (n > 2500) altitude = 'high';
                              else if (n > 1000) altitude = 'moderate';
                            }
                            updateProfile({
                              altitudeMeters: n as any,
                              altitude,
                            } as Partial<HydrationProfile>);
                          }}
                          placeholder="e.g., 5"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="raceTemp">Temperature (°C)</Label>
                        <Input
                          id="raceTemp"
                          type="number"
                          value={
                            profile.raceTempRange &&
                            profile.raceTempRange.min === profile.raceTempRange.max
                              ? profile.raceTempRange.min
                              : ''
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === '') {
                              updateProfile({
                                raceTempRange: undefined,
                              } as Partial<HydrationProfile>);
                              return;
                            }
                            const n = Number(v);
                            if (!Number.isNaN(n)) {
                              updateProfile({
                                raceTempRange: { min: n, max: n },
                                trainingTempRange: profile.trainingTempRange ?? { min: n, max: n },
                              } as Partial<HydrationProfile>);
                            }
                          }}
                          placeholder="e.g., 18"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Triathlon pace / duration */}
                {profile.disciplines?.[0] === 'Triathlon' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="swimPace">Swim Pace</Label>
                        <Input
                          id="swimPace"
                          value={profile.swimPace || ''}
                          onChange={(e) => {
                            const newProfile = { ...profile, swimPace: e.target.value };
                            const duration = calculateTriathlonDuration(newProfile);
                            updateProfile({ swimPace: e.target.value, ...(duration && { sessionDuration: duration }) });
                          }}
                          placeholder="e.g., 1:45/100m"
                        />
                        <p className="text-xs text-muted-foreground">Min:sec per 100m</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="bikeSpeed">Bike Speed</Label>
                        <Input
                          id="bikeSpeed"
                          value={profile.bikeSpeed || profile.bikePower || ''}
                          onChange={(e) => {
                            const newProfile = { ...profile, bikeSpeed: e.target.value };
                            const duration = calculateTriathlonDuration(newProfile);
                            updateProfile({ bikeSpeed: e.target.value, ...(duration && { sessionDuration: duration }) });
                          }}
                          placeholder="e.g., 30 km/h"
                        />
                        <p className="text-xs text-muted-foreground">Average speed in km/h</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="runPace">Run Pace</Label>
                        <Input
                          id="runPace"
                          value={profile.runPace || ''}
                          onChange={(e) => {
                            const newProfile = { ...profile, runPace: e.target.value };
                            const duration = calculateTriathlonDuration(newProfile);
                            updateProfile({ runPace: e.target.value, ...(duration && { sessionDuration: duration }) });
                          }}
                          placeholder="e.g., 5:30/km"
                        />
                        <p className="text-xs text-muted-foreground">Min:sec per km</p>
                      </div>
                    </div>
                    {(() => {
                      const breakdown = getTriathlonBreakdown(profile);
                      if (breakdown) {
                        const fmtDuration = (h: number) => {
                          const hrs = Math.floor(h);
                          const rm = (h - hrs) * 60;
                          const mins = Math.floor(rm);
                          const secs = Math.round((rm - mins) * 60);
                          return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
                        };
                        return (
                          <div className="space-y-3 py-4">
                            <div className="text-center">
                              <p className="text-sm text-muted-foreground mb-2">Total Estimated Time</p>
                              <p className="text-4xl font-black text-primary">{fmtDuration(breakdown.total)}</p>
                            </div>
                            <div className="flex flex-wrap justify-center gap-2 text-xs">
                              <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300">🏊 Swim {Math.round(breakdown.swim.duration * 60)}min</span>
                              <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">T1 {Math.round(breakdown.t1.duration * 60)}min</span>
                              <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300">🚴 Bike {Math.round(breakdown.bike.duration * 60)}min</span>
                              <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">T2 {Math.round(breakdown.t2.duration * 60)}min</span>
                              <span className="px-2 py-1 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-300">🏃 Run {Math.round(breakdown.run.duration * 60)}min</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ) : (
                  <PaceDurationCalculator
                    discipline={profile.disciplines?.[0] || 'Running'}
                    raceDistance={profile.raceDistance}
                    goalTime={profile.goalTime || undefined}
                    currentPace={profile.avgPace}
                    onPaceChange={(pace) => updateProfile({ avgPace: pace })}
                    onDurationChange={(duration) => updateProfile({ sessionDuration: duration })}
                  />
                )}
              </div>

              {/* Privacy: accordion + consent */}
              {/* Advanced data & consent (kept under a single container for a cleaner first screen) */}
              <div className="bg-muted/40 p-3 sm:p-4 rounded-xl space-y-2">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="gdpr" className="border-none">
                    <AccordionTrigger className="text-xs sm:text-sm font-semibold py-3 min-h-[48px] hover:no-underline text-left touch-manipulation">
                      {t('gdpr.short')} – {t('gdpr.compliance.title')}
                    </AccordionTrigger>
                    <AccordionContent className="text-xs text-muted-foreground space-y-2 pt-1">
                      <p>{t('gdpr.ai.description')}</p>
                      <p>{t('gdpr.compliance.intro')}</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li>{t('gdpr.dataCollection.text')}</li>
                        <li>{t('gdpr.storage.text')}</li>
                        <li>{t('gdpr.rights.text')}</li>
                      </ul>
                      <p className="pt-1">{t('gdpr.contact')}</p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                <div className="flex items-center gap-3 pt-3 border-t border-border/50 min-h-[48px]">
                  <Checkbox
                    id="consent"
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked === true)}
                    className="shrink-0 h-5 w-5 touch-manipulation"
                  />
                  <label htmlFor="consent" className="text-xs sm:text-sm font-medium cursor-pointer leading-snug py-2.5 flex-1 touch-manipulation select-none">
                    {t('consent.short')}
                  </label>
                </div>
              </div>
            </div>
            </div>{/* end hidden OAuth triggers */}

            {/* Next button for step 0 */}
            <div className="pt-4 space-y-4">
              <p className="text-center text-sm sm:text-base font-bold text-foreground/95 uppercase tracking-wide px-2 leading-snug break-words">
                {t('home.hype')}
              </p>
              <Button
                onClick={handleNextStep}
                disabled={!isStepValid()}
                size="lg"
                className="w-full min-h-[52px] sm:h-14 text-base sm:text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] gap-2 touch-manipulation rounded-xl"
              >
                {t('common.next')}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

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
