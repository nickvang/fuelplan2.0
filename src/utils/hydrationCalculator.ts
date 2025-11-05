import { HydrationProfile, HydrationPlan } from '@/types/hydration';

export function calculateHydrationPlan(profile: HydrationProfile, rawSmartWatchData?: any): HydrationPlan {
  // Base sweat rate calculation (ml/hour) - Based on ACSM guidelines and recent research
  // Reference: PMID 17277604, PMID 38732589
  const baseSweatRate = {
    low: 600,    // Updated from 500ml
    medium: 900, // Updated from 750ml  
    high: 1200,  // Updated from 1000ml
  }[profile.sweatRate];

  // Store calculation details for transparency
  const calculationSteps: string[] = [];
  calculationSteps.push(`Base sweat rate: ${baseSweatRate}ml/hour (${profile.sweatRate})`);
  
  // Enhanced adjustments using smartwatch data if available
  let smartWatchAdjustments = 1.0;
  
  if (rawSmartWatchData) {
    // Whoop data adjustments
    if (rawSmartWatchData.physiologicalCycles && rawSmartWatchData.physiologicalCycles.length > 0) {
      const recent = rawSmartWatchData.physiologicalCycles.slice(-7); // Last week
      const avgRecovery = recent.reduce((sum: number, c: any) => sum + c.recoveryScore, 0) / recent.length;
      const avgHRV = recent.reduce((sum: number, c: any) => sum + c.hrv, 0) / recent.length;
      
      // Low recovery or low HRV = higher hydration need
      if (avgRecovery < 50) {
        smartWatchAdjustments *= 1.15;
        calculationSteps.push(`Low recovery score (${avgRecovery.toFixed(0)}%) → +15% hydration need`);
      }
      if (avgHRV < 50) {
        smartWatchAdjustments *= 1.1;
        calculationSteps.push(`Low HRV (${avgHRV.toFixed(0)}ms) → +10% hydration need`);
      }
      
      // Poor sleep quality = higher hydration need
      const avgSleepPerf = recent.reduce((sum: number, c: any) => sum + c.sleepPerformance, 0) / recent.length;
      if (avgSleepPerf < 70) {
        smartWatchAdjustments *= 1.1;
        calculationSteps.push(`Poor sleep quality (${avgSleepPerf.toFixed(0)}%) → +10% hydration need`);
      }
    }
    
    // Workout strain adjustments
    if (rawSmartWatchData.workouts && rawSmartWatchData.workouts.length > 0) {
      const recentWorkouts = rawSmartWatchData.workouts.slice(-5);
      const avgStrain = recentWorkouts.reduce((sum: number, w: any) => sum + w.strain, 0) / recentWorkouts.length;
      
      if (avgStrain > 15) {
        smartWatchAdjustments *= 1.2;
        calculationSteps.push(`High workout strain (${avgStrain.toFixed(1)}) → +20% hydration need`);
      }
    }
  }

  // Adjust for temperature (using training temp average)
  const avgTemp = (profile.trainingTempRange.min + profile.trainingTempRange.max) / 2;
  const tempMultiplier = avgTemp < 15 ? 0.8 : avgTemp > 25 ? 1.3 : 1.0;
  calculationSteps.push(`Temperature adjustment: ${avgTemp}°C → ${tempMultiplier}x multiplier`);

  // Adjust for humidity
  const humidityMultiplier = profile.humidity < 40 ? 0.9 : 
                             profile.humidity > 70 ? 1.2 : 1.0;
  calculationSteps.push(`Humidity adjustment: ${profile.humidity}% → ${humidityMultiplier}x multiplier`);

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
    altitudeMultiplier * sunMultiplier * environmentMultiplier * smartWatchAdjustments
  );
  calculationSteps.push(`Final sweat rate: ${sweatRatePerHour}ml/hour (after all adjustments)`);

  // Total fluid loss for the activity
  const totalFluidLoss = sweatRatePerHour * profile.sessionDuration;
  calculationSteps.push(`Total fluid loss: ${sweatRatePerHour}ml/hr × ${profile.sessionDuration}hr = ${totalFluidLoss}ml`);

  // Pre-activity hydration - ACSM recommendations (PMID 17277604)
  const preWater = 400 + (profile.weight * 5); // 400-600ml based on weight
  const preElectrolytes = 1; // 1 sachet (30ml) of Supplme

  // During activity - Updated based on personalized hydration research (PMID 38732589)
  // Aim to replace 60-80% of sweat losses during exercise
  const duringWater = profile.sessionDuration > 1 ? Math.round(sweatRatePerHour * 0.7) : 0;
  // Electrolytes: approximately 1 sachet per hour for activities > 1 hour
  const duringElectrolytes = profile.sessionDuration > 1 ? Math.round(profile.sessionDuration) : 0;

  // Post-activity (150% of fluid lost) - Enhanced rehydration protocol
  // Cap at reasonable recovery amounts to drink over 4-6 hours
  const postWater = Math.min(Math.round(totalFluidLoss * 1.5), 3000);
  const postElectrolytes = Math.min(Math.max(1, Math.round(totalFluidLoss / 1000)), 4);

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
  recommendations.push('Each 30ml Supplme sachet provides 500mg sodium, 250mg potassium, and 100mg magnesium');
  recommendations.push('Drink Supplme sachets directly - no mixing required');

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
    calculationSteps,
    scientificReferences: [
      {
        pmid: '17277604',
        title: 'American College of Sports Medicine position stand. Exercise and fluid replacement.',
        citation: 'Med Sci Sports Exerc. 2007 Feb;39(2):377-90',
        url: 'https://pubmed.ncbi.nlm.nih.gov/17277604/'
      },
      {
        pmid: '38732589',
        title: 'Personalized Hydration Strategy to Improve Fluid Balance and Intermittent Exercise Performance In The Heat',
        citation: 'Nutrients. 2024 May 3;16(9):1341',
        url: 'https://pubmed.ncbi.nlm.nih.gov/38732589/'
      },
      {
        pmid: '23320854',
        title: 'Water and sodium intake habits and status of ultra-endurance athletes',
        citation: 'Nutr Metab Insights. 2013 Jan 6;6:13-27',
        url: 'https://pubmed.ncbi.nlm.nih.gov/23320854/'
      }
    ]
  };
}
