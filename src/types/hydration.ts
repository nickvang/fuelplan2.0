export interface HydrationProfile {
  // Body & Physiology
  age: number;
  sex: 'male' | 'female' | 'other';
  weight: number;
  
  // Activity
  activityType: 'running' | 'cycling' | 'trail' | 'triathlon' | 'other';
  duration: number;
  intensity: 'low' | 'moderate' | 'high';
  
  // Environment
  temperature: number;
  humidity: 'low' | 'medium' | 'high';
  
  // Sweat Data
  sweatRate: 'low' | 'medium' | 'high';
  sweatSaltiness: 'low' | 'medium' | 'high';
  
  // Goals
  goal: 'performance' | 'endurance' | 'recovery';
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
