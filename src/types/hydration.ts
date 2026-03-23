/** Supplme Electrolyte sachet – single source of truth for product composition (mg per sachet). */
export const SUPPLME_ELECTROLYTE_SPEC = {
  sodium: 500,
  potassium: 250,
  citrate: 1380,
  chloride: 230,
  magnesium: 100,
} as const;

/**
 * Medically-grounded sachet safety limits.
 * - NIH UL for supplemental Mg = 350mg/day. Each sachet = 100mg Mg.
 * - Absolute event max of 6 keeps total Mg from sachets at 600mg (spread over hours).
 * - 1/h standard, 2/h extreme (200mg Mg/h acute ceiling).
 * - 20min minimum gap between sachets for GI absorption.
 * - 800ml/h water absorption ceiling (ACSM).
 */
export const SACHET_SAFETY = {
  absoluteMaxPerEvent: 6,
  standardPerHour: 1,
  extremePerHour: 2,
  minGapMinutes: 20,
  waterCeilingMlPerHour: 800,
  postImmediateWaterCap: 500,
  /** Duration-based during budgets: [minHours, maxSachets] */
  duringBudgets: [
    { minHours: 0, max: 0 },
    { minHours: 1, max: 1 },
    { minHours: 2, max: 2 },
    { minHours: 3, max: 3 },
    { minHours: 4, max: 4 },
    { minHours: 6, max: 5 },
  ] as const,
} as const;

export interface PlanAlert {
  level: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
}

export interface StravaIntelligence {
  hrIntensityPct?: number;
  vo2maxEstimate?: number;
  cardiacDriftScore?: number;
  raceRatio?: number;
  terrainIntensity?: number;
  heatActivityRatio?: number;
  trainingLoadTrend?: 'building' | 'maintaining' | 'recovering';
  cyclingWPerKg?: number;
  runFitnessTier?: 'beginner' | 'intermediate' | 'advanced' | 'elite';
  avgSufferScore?: number;
  climateZone?: 'cold' | 'temperate' | 'hot' | 'tropical';
  longestActivityHours?: number;
}

export interface AthleteCalibration {
  sweat_coefficient: number;
  sodium_coefficient: number;
  water_coefficient: number;
  pre_water_coefficient: number;
  total_feedback_count: number;
  condition_outcomes?: Record<string, { better: number; same: number; worse: number }>;
}

export interface HydrationProfile {
  // 1. Body & Physiology
  fullName?: string;
  age: number;
  sex: 'male' | 'female' | 'other';
  height: number;
  weight: number;
  bodyFat?: number;
  restingHeartRate?: number;
  hrv?: string;
  healthConditions?: string;
  sweatSodiumTest?: number;
  
  // 2. Activity & Terrain
  disciplines: string[];
  terrain?: string;
  raceDistance?: string;
  goalTime?: string; // Target finish time (e.g., "1:30:00")
  sessionDuration: number;
  avgPace?: string;
  swimPace?: string;
  swimDistance?: string;
  swimTemperature?: number; // Triathlon swim temperature in Celsius
  bikePower?: string;
  bikeSpeed?: string; // Bike speed in km/h for triathlons
  bikeDistance?: string;
  runPace?: string;
  runDistance?: string;
  elevationGain?: number;
  longestSession?: number;
  trainingFrequency?: number;
  indoorOutdoor: 'indoor' | 'outdoor' | 'both';
  
  // Football-specific fields
  position?: string;
  matchesPerWeek?: number;
  playingLevel?: string;
  playingSurface?: string;
  avgDistanceCovered?: number;
  
  // Padel Tennis-specific fields
  padelPlayingLevel?: string;
  padelCourtType?: string;
  padelPlayingStyle?: string;
  padelMatchesPerWeek?: number;
  padelTournamentPlay?: boolean;
  
  // 3. Environment Data
  trainingTempRange: { min: number; max: number };
  raceTempRange?: { min: number; max: number };
  humidity: number;
  altitude: 'sea-level' | 'moderate' | 'high';
  altitudeMeters?: number; // Exact altitude in meters for pro/advanced users
  sunExposure: 'shade' | 'partial' | 'full-sun';
  windConditions: 'calm' | 'moderate' | 'windy';
  clothingType: 'minimal' | 'light' | 'moderate' | 'heavy';
  climate?: string;
  
  // 4. Hydration & Sweat Data
  sweatRate: 'low' | 'medium' | 'high';
  sweatSaltiness: 'low' | 'medium' | 'high';
  /** Known sodium loss in mg per hour (e.g. from sweat test). When set, overrides sweatSaltiness for electrolyte calc. */
  knownSodiumLossPerHour?: number;
  fluidIntake?: number;
  urineColor?: number;
  crampTiming?: 'none' | 'early' | 'mid' | 'late' | 'post';
  dehydrationSymptoms?: string[];
  hydrationStrategy?: string;
  
  // 5. Nutrition & Fueling
  fuelingStrategy?: string;
  preMealTiming?: number;
  recoveryWindow?: number;
  caffeineStrategy?: 'pre' | 'mid' | 'post' | 'none';
  dailySaltIntake: 'low' | 'medium' | 'high';
  dailyWaterIntake?: number;
  caffeineIntake?: number;
  dietType?: string;
  nutritionNotes?: string;
  otherSupplements?: string;
  specialDiet?: string;
  
  // 6. Goals & Performance
  targetEvents?: string;
  performanceGoal?: string;
  pastIssues?: string;
  primaryGoal: 'performance' | 'endurance' | 'recovery' | 'weight-loss' | 'general-health';
  hasUpcomingRace?: boolean;
  upcomingEvents?: string;
  specificConcerns?: string;
  
  // 7. Optional Data
  weeklyVolume?: number;
  sleepQuality?: number;
  sleepHours?: number;
  otherNotes?: string;
  
  /** Optional heart-rate profile derived from Strava (median average HR per discipline). */
  hrProfile?: {
    [discipline: string]: {
      /** Median average HR (bpm) for that discipline from recent activities. */
      average: number;
    };
  };

  /** Strava-derived intelligence signals for enhanced calculation. */
  stravaIntelligence?: StravaIntelligence;

  /** Bottle count available during activity (for carrying capacity estimates). */
  bottleCount?: number;

  /** Adaptive calibration from prior feedback (requires >= 3 feedback submissions). */
  calibration?: AthleteCalibration;
}

export interface HydrationPlan {
  preActivity: {
    timing: string;
    water: number;
    electrolytes: number;
  };
  duringActivity: {
    waterPerHour: number;
    electrolytesPerHour: number;
    totalElectrolytes: number;
    frequency: string;
  };
  postActivity: {
    water: number;
    electrolytes: number;
    timing: string;
  };
  totalFluidLoss: number;
  recommendations: string[];
  calculationSteps: string[];
  triathlonSegments?: TriathlonSegmentPlan;
  scientificReferences: Array<{
    pmid: string;
    title: string;
    citation: string;
    url: string;
  }>;
  /** 1-5 confidence score based on data source quality. */
  confidenceScore?: number;
  /** List of data sources that contributed to the plan. */
  activeDataSources?: string[];
  /** Pre-flight safety alerts (errors/warnings/info). */
  preflight?: PlanAlert[];
  /** Post-calculation validation notes. */
  validation?: PlanAlert[];
  /** Safety flags for UI indicators. */
  safetyFlags?: {
    maxAmountApplied?: boolean;
    absoluteCeilingApplied?: boolean;
    waterCeilingApplied?: boolean;
    healthConditionCap?: boolean;
  };
}

export interface TriathlonSegmentPlan {
  swim: { duration: number; distance: number; sachets: number; fluid: number };
  t1: { duration: number; sachets: number; fluid: number };
  bike: { duration: number; distance: number; sachets: number; fluid: number };
  t2: { duration: number; sachets: number; fluid: number };
  run: { duration: number; distance: number; sachets: number; fluid: number };
  totalDuration: number;
  totalSachets: number;
  totalFluid: number;
}

export interface AIValidation {
  status: 'approved' | 'adjusted';
  warnings: string[];
  adjustments?: string[];
}

export interface AIEnhancedInsights {
  personalized_insight: string;
  risk_factors: string;
  confidence_level: 'high' | 'medium' | 'low';
  professional_recommendation: string;
  performance_comparison: string;
  optimization_tips: string[];
  plan_validation?: AIValidation;
}
