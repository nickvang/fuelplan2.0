import { HydrationProfile, HydrationPlan } from '@/types/hydration';

export function calculateHydrationPlan(profile: HydrationProfile): HydrationPlan {
  // Base sweat rate calculation (ml/hour)
  const baseSweatRate = {
    low: 500,
    medium: 750,
    high: 1000,
  }[profile.sweatRate];

  // Adjust for temperature
  const tempMultiplier = profile.temperature < 15 ? 0.8 : 
                         profile.temperature > 25 ? 1.3 : 1.0;

  // Adjust for humidity
  const humidityMultiplier = {
    low: 0.9,
    medium: 1.0,
    high: 1.2,
  }[profile.humidity];

  // Adjust for intensity
  const intensityMultiplier = {
    low: 0.8,
    moderate: 1.0,
    high: 1.3,
  }[profile.intensity];

  // Calculate total sweat rate
  const sweatRatePerHour = Math.round(
    baseSweatRate * tempMultiplier * humidityMultiplier * intensityMultiplier
  );

  // Total fluid loss for the activity
  const totalFluidLoss = sweatRatePerHour * profile.duration;

  // Pre-activity hydration
  const preWater = 400 + (profile.weight * 5); // 400-600ml based on weight
  const preElectrolytes = 1; // 1 dose

  // During activity (per hour if > 60 minutes)
  const duringWater = profile.duration > 1 ? sweatRatePerHour : 0;
  const duringElectrolytes = profile.duration > 1 ? 1 : 0;

  // Post-activity (150% of fluid lost)
  const postWater = Math.round(totalFluidLoss * 1.5);
  const postElectrolytes = 1;

  // Generate recommendations based on profile
  const recommendations: string[] = [];

  if (profile.sweatRate === 'high' || profile.sweatSaltiness === 'high') {
    recommendations.push('Your high sweat rate requires extra attention to electrolyte replacement');
  }

  if (profile.temperature > 25) {
    recommendations.push('Hot conditions increase dehydration risk - start hydrating early');
  }

  if (profile.duration > 2) {
    recommendations.push('For sessions over 2 hours, maintain consistent fluid intake every 15-20 minutes');
  }

  if (profile.intensity === 'high') {
    recommendations.push('High intensity training increases electrolyte loss through sweat');
  }

  recommendations.push('Monitor urine color - pale yellow indicates good hydration');
  recommendations.push('Each Supplme dose provides 500mg sodium, 250mg potassium, and 100mg magnesium');

  return {
    preActivity: {
      timing: '2 hours before',
      water: preWater,
      electrolytes: preElectrolytes,
    },
    duringActivity: {
      waterPerHour: duringWater,
      electrolytesPerHour: duringElectrolytes,
      frequency: 'Every 15-20 minutes',
    },
    postActivity: {
      water: postWater,
      electrolytes: postElectrolytes,
      timing: 'Within 30 minutes',
    },
    totalFluidLoss: totalFluidLoss,
    recommendations,
  };
}
