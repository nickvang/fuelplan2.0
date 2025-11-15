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
  sessionDuration: number;
  avgPace?: string;
  swimPace?: string;
  swimTemperature?: number; // Triathlon swim temperature in Celsius
  bikePower?: string;
  runPace?: string;
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
  scientificReferences: Array<{
    pmid: string;
    title: string;
    citation: string;
    url: string;
  }>;
}

export interface AIEnhancedInsights {
  personalized_insight: string;
  risk_factors: string;
  confidence_level: 'high' | 'medium' | 'low';
  professional_recommendation: string;
  performance_comparison: string;
  optimization_tips: string[];
}
