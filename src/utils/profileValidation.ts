import { z } from 'zod';

// Client-side validation schema for hydration profile
export const profileSchema = z.object({
  // Body & Physiology
  age: z.number().min(13, "Age must be at least 13").max(120, "Age must be less than 120").optional(),
  weight: z.number().min(30, "Weight must be at least 30kg").max(300, "Weight must be less than 300kg").optional(),
  height: z.number().min(100, "Height must be at least 100cm").max(250, "Height must be less than 250cm").optional(),
  sex: z.enum(['male', 'female']).optional(),
  bodyFatPercentage: z.number().min(3).max(50).optional(),
  restingHeartRate: z.number().min(30).max(120).optional(),
  avgSleepHours: z.number().min(0).max(24).optional(),
  
  // Activity & Terrain
  disciplines: z.array(z.string()).min(1, "At least one discipline is required").optional(),
  sessionDuration: z.number().min(0.25, "Session must be at least 15 minutes").max(168, "Session must be less than 7 days").optional(),
  indoorOutdoor: z.enum(['indoor', 'outdoor', 'both']).optional(),
  
  // Environment Data
  trainingTemp: z.number().min(-20).max(50).optional(),
  trainingTempRange: z.object({
    min: z.number().min(-20).max(50),
    max: z.number().min(-20).max(50)
  }).optional(),
  trainingHumidity: z.number().min(0).max(100).optional(),
  trainingAltitude: z.number().min(0).max(5000).optional(),
  sunExposure: z.enum(['shade', 'partial', 'full-sun']).optional(),
  windConditions: z.enum(['calm', 'moderate', 'windy']).optional(),
  clothingType: z.string().optional(),
  
  // Sweat Profile
  sweatRate: z.enum(['low', 'medium', 'high']).optional(),
  sweatSaltiness: z.enum(['low', 'medium', 'high']).optional(),
  experienceCramping: z.boolean().optional(),
  
  // Dietary Habits
  dailySaltIntake: z.enum(['low', 'medium', 'high']).optional(),
  dailyWaterIntake: z.number().min(0).max(10).optional(),
  caffeineIntake: z.number().min(0).max(2000).optional(),
  dietType: z.string().max(50).optional(),
  
  // Goals & Events
  primaryGoal: z.enum(['performance', 'endurance', 'recovery', 'weight-loss', 'general-health']).optional(),
  hasUpcomingRace: z.boolean().optional(),
  upcomingEvent: z.string().max(200, "Event description too long").optional(),
  concerns: z.string().max(500, "Concerns text too long").optional(),
  
  // Optional fields
  userEmail: z.string().email("Invalid email address").max(255, "Email too long").optional().or(z.literal('')),
});

export type ValidatedProfile = z.infer<typeof profileSchema>;

// Sanitize string inputs to prevent XSS
export const sanitizeString = (str: string | undefined): string | undefined => {
  if (!str) return str;
  return str
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .slice(0, 1000); // Limit length
};

// Validate and sanitize profile before submission
export const validateAndSanitizeProfile = (profile: any) => {
  // Sanitize string fields
  if (profile.upcomingEvents) {
    profile.upcomingEvents = sanitizeString(profile.upcomingEvents);
  }
  if (profile.upcomingEvent) {
    profile.upcomingEvent = sanitizeString(profile.upcomingEvent);
  }
  if (profile.concerns) {
    profile.concerns = sanitizeString(profile.concerns);
  }
  if (profile.userEmail) {
    profile.userEmail = sanitizeString(profile.userEmail);
  }
  if (profile.dietType) {
    profile.dietType = sanitizeString(profile.dietType);
  }
  if (profile.clothingType) {
    profile.clothingType = sanitizeString(profile.clothingType);
  }
  
  // Validate with zod
  const result = profileSchema.safeParse(profile);
  
  if (!result.success) {
    const errors = result.error.errors.map(err => 
      `${err.path.join('.')}: ${err.message}`
    );
    throw new Error(`Validation failed:\n${errors.join('\n')}`);
  }
  
  return result.data;
};
