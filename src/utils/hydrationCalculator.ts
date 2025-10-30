import { HydrationProfile, HydrationPlan } from '@/types/hydration';

export function calculateHydrationPlan(profile: HydrationProfile): HydrationPlan {
  // Base sweat rate calculation (ml/hour)
  const baseSweatRate = {
    low: 500,
    medium: 750,
    high: 1000,
  }[profile.sweatRate];

  // Adjust for temperature (using training temp average)
  const avgTemp = (profile.trainingTempRange.min + profile.trainingTempRange.max) / 2;
  const tempMultiplier = avgTemp < 15 ? 0.8 : avgTemp > 25 ? 1.3 : 1.0;

  // Adjust for humidity
  const humidityMultiplier = profile.humidity < 40 ? 0.9 : 
                             profile.humidity > 70 ? 1.2 : 1.0;

  // Adjust for altitude
  const altitudeMultiplier = {
    'sea-level': 1.0,
    'moderate': 1.1,
    'high': 1.2,
  }[profile.altitude];

  // Adjust for sun exposure
  const sunMultiplier = {
    'shade': 0.9,
    'partial': 1.0,
    'full-sun': 1.15,
  }[profile.sunExposure];

  // Adjust for indoor/outdoor
  const environmentMultiplier = profile.indoorOutdoor === 'indoor' ? 0.85 : 1.0;

  // Calculate total sweat rate
  const sweatRatePerHour = Math.round(
    baseSweatRate * tempMultiplier * humidityMultiplier * 
    altitudeMultiplier * sunMultiplier * environmentMultiplier
  );

  // Total fluid loss for the activity
  const totalFluidLoss = sweatRatePerHour * profile.sessionDuration;

  // Pre-activity hydration
  const preWater = 400 + (profile.weight * 5); // 400-600ml based on weight
  const preElectrolytes = 1; // 1 dose

  // During activity (per hour if > 60 minutes)
  const duringWater = profile.sessionDuration > 1 ? sweatRatePerHour : 0;
  const duringElectrolytes = profile.sessionDuration > 1 ? 1 : 0;

  // Post-activity (150% of fluid lost)
  const postWater = Math.round(totalFluidLoss * 1.5);
  const postElectrolytes = 1;

  // Generate recommendations based on profile
  const recommendations: string[] = [];

  if (profile.sweatRate === 'high' || profile.sweatSaltiness === 'high') {
    recommendations.push('Your high sweat rate requires extra attention to electrolyte replacement');
  }

  if (avgTemp > 25) {
    recommendations.push('Hot conditions increase dehydration risk - start hydrating early');
  }

  if (profile.sessionDuration > 2) {
    recommendations.push('For sessions over 2 hours, maintain consistent fluid intake every 15-20 minutes');
  }

  if (profile.altitude !== 'sea-level') {
    recommendations.push('Higher altitude increases fluid loss - increase hydration by 10-20%');
  }

  if (profile.sunExposure === 'full-sun') {
    recommendations.push('Full sun exposure increases sweat rate - prioritize shade when possible');
  }

  if (profile.elevationGain && profile.elevationGain > 500) {
    recommendations.push('Significant elevation gain increases energy and fluid demands');
  }

  if (profile.crampTiming && profile.crampTiming !== 'none') {
    recommendations.push('Cramping indicates electrolyte imbalance - consider increasing Supplme dosage');
  }

  if (profile.dailySaltIntake === 'low') {
    recommendations.push('Low daily salt intake may require additional electrolyte supplementation');
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
