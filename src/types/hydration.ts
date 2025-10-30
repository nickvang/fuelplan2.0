export interface HydrationProfile {
  // 1. Body & Physiology
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
  raceDistance?: string;
  sessionDuration: number;
  avgPace?: string;
  elevationGain?: number;
  longestSession?: number;
  trainingFrequency?: number;
  indoorOutdoor: 'indoor' | 'outdoor' | 'both';
  
  // 3. Environment Data
  trainingTempRange: { min: number; max: number };
  raceTempRange?: { min: number; max: number };
  humidity: number;
  altitude: 'sea-level' | 'moderate' | 'high';
  sunExposure: 'shade' | 'partial' | 'full-sun';
  windConditions: 'calm' | 'moderate' | 'windy';
  clothingType: 'light' | 'compression' | 'layers';
  climate?: string;
  
  // 4. Hydration & Sweat Data
  sweatRate: 'low' | 'medium' | 'high';
  sweatSaltiness: 'low' | 'medium' | 'high';
  fluidIntake?: number;
  urineColor?: number;
  crampTiming?: 'during' | 'after' | 'night' | 'none';
  dehydrationSymptoms?: string[];
  
  // 5. Nutrition & Fueling
  fuelingStrategy?: string;
  preMealTiming?: number;
  recoveryWindow?: number;
  caffeineStrategy?: 'pre' | 'mid' | 'post' | 'none';
  dailySaltIntake: 'low' | 'medium' | 'high';
  otherSupplements?: string;
  specialDiet?: string;
  
  // 6. Goals & Performance
  targetEvents?: string;
  performanceGoal?: string;
  pastIssues?: string;
  primaryGoal: 'performance' | 'recovery' | 'daily-hydration' | 'completion';
  
  // 7. Optional Data
  weeklyVolume?: number;
  sleepQuality?: number;
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
}
