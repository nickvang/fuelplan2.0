import { HydrationProfile, HydrationPlan } from '@/types/hydration';

export function calculateHydrationPlan(profile: HydrationProfile, rawSmartWatchData?: any): HydrationPlan {
  // Base sweat rate calculation (ml/hour) - Based on ACSM guidelines and recent research
  // Reference: PMID 17277604, PMID 38732589
  const baseSweatRate = {
    low: 500,    // Conservative baseline
    medium: 750, // Typical athlete  
    high: 1000,  // High sweater
  }[profile.sweatRate];

  // Store calculation details for transparency
  const calculationSteps: string[] = [];
  calculationSteps.push(`Base sweat rate: ${baseSweatRate}ml/hour (${profile.sweatRate})`);
  
  // Use ADDITIVE adjustments instead of multiplicative to prevent extreme values
  let adjustmentFactor = 0; // Start at 0, add percentages
  
  // Enhanced adjustments using smartwatch data if available
  if (rawSmartWatchData) {
    // Whoop data adjustments - reduce impact
    if (rawSmartWatchData.physiologicalCycles && rawSmartWatchData.physiologicalCycles.length > 0) {
      const recent = rawSmartWatchData.physiologicalCycles.slice(-7); // Last week
      const avgRecovery = recent.reduce((sum: number, c: any) => sum + c.recoveryScore, 0) / recent.length;
      const avgHRV = recent.reduce((sum: number, c: any) => sum + c.hrv, 0) / recent.length;
      
      // Low recovery or low HRV = slightly higher hydration need
      if (avgRecovery < 50) {
        adjustmentFactor += 0.10; // +10% instead of 15%
        calculationSteps.push(`Low recovery score (${avgRecovery.toFixed(0)}%) → +10% hydration need`);
      }
      if (avgHRV < 50) {
        adjustmentFactor += 0.05; // +5% instead of 10%
        calculationSteps.push(`Low HRV (${avgHRV.toFixed(0)}ms) → +5% hydration need`);
      }
      
      // Poor sleep quality = slightly higher hydration need
      const avgSleepPerf = recent.reduce((sum: number, c: any) => sum + c.sleepPerformance, 0) / recent.length;
      if (avgSleepPerf < 70) {
        adjustmentFactor += 0.05; // +5% instead of 10%
        calculationSteps.push(`Poor sleep quality (${avgSleepPerf.toFixed(0)}%) → +5% hydration need`);
      }
    }
    
    // Workout strain adjustments - reduce impact
    if (rawSmartWatchData.workouts && rawSmartWatchData.workouts.length > 0) {
      const recentWorkouts = rawSmartWatchData.workouts.slice(-5);
      const avgStrain = recentWorkouts.reduce((sum: number, w: any) => sum + w.strain, 0) / recentWorkouts.length;
      
      if (avgStrain > 15) {
        adjustmentFactor += 0.10; // +10% instead of 20%
        calculationSteps.push(`High workout strain (${avgStrain.toFixed(1)}) → +10% hydration need`);
      }
    }
  }

  // Temperature adjustment - ADDITIVE
  const avgTemp = (profile.trainingTempRange.min + profile.trainingTempRange.max) / 2;
  if (avgTemp < 10) {
    adjustmentFactor += -0.20; // -20% for cold
    calculationSteps.push(`Temperature adjustment: ${avgTemp}°C → -20%`);
  } else if (avgTemp > 25) {
    adjustmentFactor += 0.25; // +25% for hot
    calculationSteps.push(`Temperature adjustment: ${avgTemp}°C → +25%`);
  } else {
    calculationSteps.push(`Temperature adjustment: ${avgTemp}°C → no change`);
  }

  // Humidity adjustment - ADDITIVE
  if (profile.humidity > 70) {
    adjustmentFactor += 0.15; // +15% for high humidity
    calculationSteps.push(`Humidity adjustment: ${profile.humidity}% → +15%`);
  } else if (profile.humidity < 30) {
    adjustmentFactor += -0.10; // -10% for low humidity
    calculationSteps.push(`Humidity adjustment: ${profile.humidity}% → -10%`);
  }

  // Altitude adjustment - ADDITIVE
  if (profile.altitude === 'high') {
    adjustmentFactor += 0.15; // +15%
  } else if (profile.altitude === 'moderate') {
    adjustmentFactor += 0.08; // +8%
  }

  // Sun exposure - ADDITIVE
  if (profile.sunExposure === 'full-sun') {
    adjustmentFactor += 0.10; // +10%
  } else if (profile.sunExposure === 'shade') {
    adjustmentFactor += -0.10; // -10%
  }

  // Indoor reduces sweat rate
  if (profile.indoorOutdoor === 'indoor') {
    adjustmentFactor += -0.15; // -15%
  }

  // Cap total adjustment at reasonable limits
  adjustmentFactor = Math.max(-0.30, Math.min(0.60, adjustmentFactor)); // Cap between -30% and +60%

  // Calculate total sweat rate with REALISTIC CAP
  const calculatedSweatRate = Math.round(baseSweatRate * (1 + adjustmentFactor));
  const sweatRatePerHour = Math.min(calculatedSweatRate, 1400); // HARD CAP at 1400ml/hour (medically safe)
  calculationSteps.push(`Final sweat rate: ${sweatRatePerHour}ml/hour (capped at 1400ml/hour for safety)`);

  // Total fluid loss for the activity
  const totalFluidLoss = sweatRatePerHour * profile.sessionDuration;
  calculationSteps.push(`Total fluid loss: ${sweatRatePerHour}ml/hr × ${profile.sessionDuration}hr = ${totalFluidLoss}ml`);

  // Pre-activity hydration - ACSM recommendations (PMID 17277604)
  const preWater = 400 + (profile.weight * 5); // 400-600ml based on weight
  const preElectrolytes = 1; // 1 sachet (30ml) of Supplme

  // During activity - Based on ACSM & IOC consensus (PMID 17277604, PMID 38732589)
  // For activities > 45 min: aim to replace 60-70% of sweat losses (not 70-80% to prevent overhydration)
  // ACSM recommends max 800ml per hour for most athletes
  const duringWater = profile.sessionDuration >= 0.75 
    ? Math.min(Math.round(sweatRatePerHour * 0.65), 1000) // Cap at 1000ml/hour
    : 0;
  
  // Electrolyte requirements (sachets) - CONSERVATIVE approach:
  // < 1 hour: 0 sachets (rely on pre-load)
  // 1-2 hours: 1 sachet total
  // 2-3 hours: 2 sachets total
  // > 3 hours: 2-3 sachets total (not per hour!)
  let duringElectrolytes = 0;
  if (profile.sessionDuration >= 1 && profile.sessionDuration < 2) {
    duringElectrolytes = 1; // 1 sachet for 1-2 hour activities
  } else if (profile.sessionDuration >= 2 && profile.sessionDuration < 3) {
    duringElectrolytes = 2; // 2 sachets for 2-3 hour activities
  } else if (profile.sessionDuration >= 3) {
    // For ultra-distance: 2-3 sachets total, not per hour
    duringElectrolytes = profile.sweatRate === 'high' ? 3 : 2;
  }

  // Post-activity rehydration (PMID 17277604)
  // Target: 125-150% of fluid deficit to account for ongoing losses
  // Cap at realistic consumption over 4-6 hours (max ~400ml/hour = 2400ml total)
  const maxRealisticPostWater = 2000; // 2L max over recovery period (more realistic)
  const postWater = Math.min(Math.round(totalFluidLoss * 1.25), maxRealisticPostWater);
  
  // Electrolytes: Conservative approach - 1 sachet per 1000ml of fluid loss, cap at 3 sachets
  const postElectrolytes = Math.min(Math.max(1, Math.round(totalFluidLoss / 1000)), 3);

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
      timing: '4-6 hours',
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
