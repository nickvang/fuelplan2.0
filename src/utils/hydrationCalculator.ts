import { HydrationProfile, HydrationPlan } from '@/types/hydration';

export function calculateHydrationPlan(profile: HydrationProfile, rawSmartWatchData?: any): HydrationPlan {
  // Base sweat rate calculation (ml/hour) - CONSERVATIVE estimates
  // Research shows: Light exercise 0.3-0.5L/hr, Moderate 0.5-0.8L/hr, Intense 0.8-1.5L/hr
  // Reference: PMID 17277604, PMID 38732589
  let baseSweatRate = {
    low: 400,    // Very conservative baseline (0.4L/hr)
    medium: 600, // Conservative for typical athlete (0.6L/hr)
    high: 900,   // High sweater, still conservative (0.9L/hr)
  }[profile.sweatRate];

  // Discipline-based intensity adjustment - Different sports have different intensities
  // Research-backed adjustments based on metabolic cost and sweat rate studies
  const disciplineAdjustment: { [key: string]: number } = {
    // Low intensity activities (significantly lower sweat rates)
    'Hiking': -0.25,          // -25% for hiking (moderate pace, lower intensity)
    'Walking': -0.35,         // -35% for walking (very low intensity)
    'Swimming': -0.30,        // -30% for swimming (water cooling effect)
    
    // Moderate intensity activities
    'Cycling': -0.10,         // -10% for cycling (better cooling, seated position)
    'Triathlon': 0,           // Baseline (mixed intensity)
    'Football': 0.05,         // +5% for football/soccer (intermittent high intensity)
    'Padel': 0,               // Baseline for padel tennis (moderate intensity)
    'Tennis': 0,              // Baseline for tennis (moderate intensity)
    
    // High intensity activities
    'Running': 0.10,          // +10% for running (higher impact, sustained effort)
    'Trail Running': 0.15,    // +15% for trail running (more demanding terrain)
    'Basketball': 0.10,       // +10% for basketball (high intensity intervals)
    'CrossFit': 0.15,         // +15% for CrossFit (very high intensity)
  };
  
  // Apply discipline adjustment if applicable
  const primaryDiscipline = profile.disciplines?.[0] || '';
  if (disciplineAdjustment[primaryDiscipline] !== undefined) {
    baseSweatRate = Math.round(baseSweatRate * (1 + disciplineAdjustment[primaryDiscipline]));
  }

  // Store calculation details for transparency
  const calculationSteps: string[] = [];
  calculationSteps.push(`Base sweat rate: ${baseSweatRate}ml/hour (${profile.sweatRate}${disciplineAdjustment[primaryDiscipline] ? `, adjusted for ${primaryDiscipline}` : ''})`);
  
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

  // During activity - CONSERVATIVE approach based on ACSM & IOC consensus
  // Research shows many athletes perform well with minimal during-activity hydration for runs < 90 min
  // For short runs (< 75 min): minimal or no during hydration needed if properly pre-hydrated
  // For longer runs: Replace 50-60% of sweat losses to avoid both dehydration AND overhydration
  // ACSM recommends max 800ml per hour for most athletes (PMID 17277604)
  let duringWater = 0;
  if (profile.sessionDuration < 0.75) {
    duringWater = 0; // No during-activity hydration needed for runs < 45 min
  } else if (profile.sessionDuration < 1.5) {
    // For 45-90 min runs: very conservative, 40% replacement
    duringWater = Math.min(Math.round(sweatRatePerHour * 0.40), 600);
  } else {
    // For longer runs: 50% replacement, capped at 800ml/hour (ACSM recommendation)
    duringWater = Math.min(Math.round(sweatRatePerHour * 0.50), 800);
  }
  
  // Electrolyte requirements (sachets) - EVIDENCE-BASED approach for INTENSITY
  // Lower intensity activities need fewer electrolytes than high-intensity ones
  // Sports science shows pre-loading is sufficient for activities under 75 minutes
  // < 75 min: 0 sachets during (rely on pre-load)
  // 75-120 min LOW intensity: 0 sachet
  // 75-120 min MODERATE intensity: 0-1 sachet
  // 75-120 min HIGH intensity: 1 sachet during
  // 2-3 hours LOW intensity: 1 sachet
  // 2-3 hours MODERATE intensity: 1-2 sachets
  // 2-3 hours HIGH intensity: 2 sachets total during
  // > 3 hours: 2-3 sachets total during (not per hour!)
  
  // Categorize activities by intensity for electrolyte needs
  const lowIntensity = ['Hiking', 'Walking', 'Swimming', 'Cycling'];
  const moderateIntensity = ['Triathlon', 'Padel', 'Tennis', 'Football'];
  const highIntensity = ['Running', 'Trail Running', 'Basketball', 'CrossFit'];
  
  const isLowIntensity = lowIntensity.includes(primaryDiscipline);
  const isHighIntensity = highIntensity.includes(primaryDiscipline);
  
  let duringElectrolytes = 0;
  if (profile.sessionDuration >= 1.25 && profile.sessionDuration < 2) {
    // 75-120 minutes
    if (isLowIntensity) {
      duringElectrolytes = 0; // Low intensity: pre-load sufficient
    } else if (isHighIntensity) {
      duringElectrolytes = 1; // High intensity: 1 sachet
    } else {
      duringElectrolytes = 0; // Moderate intensity: pre-load usually sufficient
    }
  } else if (profile.sessionDuration >= 2 && profile.sessionDuration < 3) {
    // 2-3 hours
    if (isLowIntensity) {
      duringElectrolytes = 1; // Low intensity: 1 sachet
    } else if (isHighIntensity) {
      duringElectrolytes = 2; // High intensity: 2 sachets
    } else {
      duringElectrolytes = 1; // Moderate intensity: 1 sachet
    }
  } else if (profile.sessionDuration >= 3) {
    // Over 3 hours (ultra-distance)
    if (isLowIntensity) {
      duringElectrolytes = 1; // Low intensity: just 1 sachet even for long duration
    } else if (isHighIntensity) {
      duringElectrolytes = profile.sweatRate === 'high' ? 3 : 2; // High intensity: 2-3 sachets
    } else {
      duringElectrolytes = 2; // Moderate intensity: 2 sachets
    }
  }

  // Post-activity rehydration - CONSERVATIVE approach (PMID 17277604)
  // Target: 120-150% of fluid deficit to account for ongoing losses
  // For short activities with minimal fluid loss, keep post-hydration conservative
  // Cap at realistic consumption over 4-6 hours
  const maxRealisticPostWater = 1800; // 1.8L max over recovery period (realistic for most athletes)
  let postWater;
  if (totalFluidLoss < 500) {
    // For very short activities, minimal post-hydration needed
    postWater = Math.min(Math.round(totalFluidLoss * 1.2), 800);
  } else {
    // Standard formula: 120% of fluid loss
    postWater = Math.min(Math.round(totalFluidLoss * 1.2), maxRealisticPostWater);
  }
  
  // Electrolytes: Always 1 sachet post-activity for recovery
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
