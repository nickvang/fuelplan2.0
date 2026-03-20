/** Supplme Electrolyte sachet – single source of truth for product composition (mg per sachet). */
export const SUPPLME_ELECTROLYTE_SPEC = {
  sodium: 500,
  potassium: 250,
  citrate: 1380,
  chloride: 230,
  magnesium: 100,
} as const;

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

export interface AIEnhancedInsights {
  personalized_insight: string;
  risk_factors: string;
  confidence_level: 'high' | 'medium' | 'low';
  professional_recommendation: string;
  performance_comparison: string;
  optimization_tips: string[];
}
