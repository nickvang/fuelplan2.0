import { HydrationProfile, HydrationPlan } from '@/types/hydration';

export function calculateHydrationPlan(profile: HydrationProfile, rawSmartWatchData?: any): HydrationPlan {
  console.log('🧮 Advanced hydration calculation starting...', {
    duration: profile.sessionDuration,
    weight: profile.weight,
    discipline: profile.disciplines?.[0],
    hasSmartwatch: !!rawSmartWatchData
  });
  
  const calculationSteps: string[] = [];
  const isRaceDay = profile.raceDistance && profile.raceDistance.length > 0;
  
  // ====== 1. ADVANCED SWEAT RATE CALCULATION ======
  const avgTemp = (profile.trainingTempRange.min + profile.trainingTempRange.max) / 2;
  const primaryDiscipline = profile.disciplines?.[0] || '';
  
  // Base sweat rates by user-selected profile (low/medium/high/very high)
  const baseSweatRates: { [key: string]: number } = {
    'low': 400,      // 0.4 L/h
    'medium': 900,   // 0.9 L/h
    'high': 1200,    // 1.2 L/h
    'very-high': 1500 // 1.5 L/h (for extreme sweaters)
  };
  
  let sweatRatePerHour = baseSweatRates[profile.sweatRate] || 700;
  calculationSteps.push(`Base sweat rate: ${sweatRatePerHour}ml/h (${profile.sweatRate} sweater)`);
  
  // Modifiers for sweat rate
  let sweatModifier = 1.0;
  const sweatAdjustments: string[] = [];
  
  // Temperature adjustment
  if (avgTemp > 30) {
    sweatModifier += 0.30; // +30% extreme heat
    sweatAdjustments.push('extreme heat +30%');
  } else if (avgTemp > 25) {
    sweatModifier += 0.20; // +20% hot
    sweatAdjustments.push('hot +20%');
  } else if (avgTemp < 15) {
    sweatModifier -= 0.10; // -10% cool
    sweatAdjustments.push('cool -10%');
  }
  
  // Body size adjustment
  if (profile.weight < 60) {
    sweatModifier -= 0.10; // -10% smaller body
    sweatAdjustments.push('body <60kg -10%');
  } else if (profile.weight > 80) {
    sweatModifier += 0.10; // +10% larger body
    sweatAdjustments.push('body >80kg +10%');
  }
  
  // Sun exposure
  if (profile.sunExposure === 'full-sun') {
    sweatModifier += 0.20; // +20% full sun
    sweatAdjustments.push('full sun +20%');
  } else if (profile.sunExposure === 'partial') {
    sweatModifier += 0.10; // +10% partial sun
    sweatAdjustments.push('partial sun +10%');
  }
  
  // Smartwatch HR drift (indicates dehydration/high stress)
  if (rawSmartWatchData?.hrDrift && rawSmartWatchData.hrDrift > 5) {
    sweatModifier += 0.15; // +15% high HR drift
    sweatAdjustments.push('HR drift >5% +15%');
  }
  
  // Sport-specific adjustment
  const sportAdjustments: { [key: string]: number } = {
    'Running': 0.10,
    'Triathlon': 0.10,
    'Cycling': 0,
    'Swimming': -0.15,
    'Gym': -0.20,
    'CrossFit': -0.10,
    'Walking': -0.20,
    'Hiking': -0.05
  };
  
  const sportAdj = sportAdjustments[primaryDiscipline] || 0;
  if (sportAdj !== 0) {
    sweatModifier += sportAdj;
    sweatAdjustments.push(`${primaryDiscipline} ${sportAdj > 0 ? '+' : ''}${(sportAdj * 100).toFixed(0)}%`);
  }
  
  // Apply all modifiers
  sweatRatePerHour = Math.round(sweatRatePerHour * sweatModifier);
  if (sweatAdjustments.length > 0) {
    calculationSteps.push(`Sweat adjustments: ${sweatAdjustments.join(', ')}`);
  }
  calculationSteps.push(`Final sweat rate: ${sweatRatePerHour}ml/h`);
  
  // Total fluid loss
  const totalFluidLoss = sweatRatePerHour * profile.sessionDuration;
  calculationSteps.push(`Total fluid loss: ${sweatRatePerHour}ml/h × ${profile.sessionDuration}h = ${totalFluidLoss}ml`);


  // ====== 2. SODIUM LOSS & SACHETS CALCULATION ======
  // Sodium concentration based on sweat saltiness
  const sodiumConcentration: { [key: string]: number } = {
    'low': 400,      // mg/L
    'medium': 800,   // mg/L
    'high': 1200,    // mg/L
  };
  
  const sodiumPerLiter = sodiumConcentration[profile.sweatSaltiness] || 800;
  const totalSodiumLoss = (sweatRatePerHour / 1000) * sodiumPerLiter * profile.sessionDuration;
  calculationSteps.push(`Sodium loss: ${sodiumPerLiter}mg/L × ${(sweatRatePerHour * profile.sessionDuration / 1000).toFixed(2)}L = ${Math.round(totalSodiumLoss)}mg total`);
  
  // SUPPLME sachet = 500mg sodium
  const SACHET_SODIUM = 500;
  
  // Calculate sachets per hour
  let sachetsPerHour = (sweatRatePerHour / 1000) * sodiumPerLiter / SACHET_SODIUM;
  
  // Adjust for heat/intensity
  if (avgTemp > 25 || (rawSmartWatchData?.hrDrift && rawSmartWatchData.hrDrift > 5)) {
    sachetsPerHour *= 1.2; // +20% for high stress
  }
  
  // Race day adjustment (higher precision needed)
  if (isRaceDay) {
    sachetsPerHour *= 1.15; // +15% for race day
  }
  
  // Round to nearest whole number (1, 2, or 3 only)
  sachetsPerHour = Math.max(1, Math.min(3, Math.round(sachetsPerHour)));
  
  // Minimum 1 sachet/hour for sessions > 60 min
  if (profile.sessionDuration > 1 && sachetsPerHour < 1) {
    sachetsPerHour = 1;
  }
  
  calculationSteps.push(`Sachets per hour: ${sachetsPerHour} (rounded to whole number, max 3 for safety)`);
  
  const totalSachetsNeeded = Math.round(sachetsPerHour * profile.sessionDuration);

  // ====== 3. PRE-ACTIVITY HYDRATION ======
  // Base: 6-8ml/kg (ACSM), using 8ml/kg as baseline (higher pre-loading)
  let preWaterBase = profile.weight * 8;
  let preAdjustmentFactor = 1.0;
  const preAdjustments: string[] = [];
  
  // Temperature
  if (avgTemp > 25) {
    preAdjustmentFactor += 0.20;
    preAdjustments.push('hot +20%');
  }
  
  // Race day or longer duration (≥75 min)
  if (isRaceDay || profile.sessionDuration >= 1.25) {
    preAdjustmentFactor += 0.15;
    preAdjustments.push(isRaceDay ? 'race day +15%' : 'duration ≥75min +15%');
  }
  
  // Session duration (very long)
  if (profile.sessionDuration >= 3) {
    preAdjustmentFactor += 0.20;
    preAdjustments.push('long session +20%');
  }
  
  // Altitude
  if (profile.altitude === 'high') {
    preAdjustmentFactor += 0.15;
    preAdjustments.push('high altitude +15%');
  } else if (profile.altitude === 'moderate') {
    preAdjustmentFactor += 0.10;
    preAdjustments.push('moderate altitude +10%');
  }
  
  const preWater = Math.round(preWaterBase * preAdjustmentFactor / 10) * 10; // Round to nearest 10ml
  const preElectrolytes = (profile.sessionDuration > 1 || isRaceDay) ? 1 : 0; // Always 1 sachet if >60min or race day
  
  if (preAdjustments.length > 0) {
    calculationSteps.push(`Pre-hydration adjustments: ${preAdjustments.join(', ')}`);
  }
  calculationSteps.push(`Pre-activity: ${preWater}ml water, ${preElectrolytes} sachet(s)`);

  // ====== 4. DURING-ACTIVITY HYDRATION ======
  // Water replacement: 50-60% training, 60-70% race day (reduced to prevent water stomach)
  const replacementRate = isRaceDay ? 0.65 : 0.55; // Average of ranges
  const duringWaterPerHour = Math.round((sweatRatePerHour * replacementRate) / 10) * 10; // Round to nearest 10ml
  const duringElectrolytesPerHour = sachetsPerHour;
  
  calculationSteps.push(`During-activity: ${duringWaterPerHour}ml/h (${(replacementRate * 100).toFixed(0)}% replacement), ${duringElectrolytesPerHour} sachet(s)/h`);
  
  // Frequency guidance
  let frequency = 'Every 15-20 minutes';
  if (profile.sessionDuration >= 2) {
    frequency = 'Every 12-15 minutes';
  }

  // ====== 5. POST-ACTIVITY HYDRATION ======
  // Calculate remaining deficit
  const totalConsumedDuring = duringWaterPerHour * profile.sessionDuration;
  const remainingDeficit = totalFluidLoss - totalConsumedDuring;
  
  // Immediate target: 70-80% within 1-2h (higher post-recovery)
  const postImmediate = Math.round((remainingDeficit * 0.75) / 10) * 10;
  
  // Total recovery: 140-160% of remaining deficit over 2-4h (compensate for lower during intake)
  const postTotal = Math.round((remainingDeficit * 1.50) / 10) * 10;
  
  // Sodium: remaining deficit
  const sodiumConsumedDuring = duringElectrolytesPerHour * profile.sessionDuration * SACHET_SODIUM;
  const sodiumConsumedPre = preElectrolytes * SACHET_SODIUM;
  const remainingSodiumDeficit = totalSodiumLoss - sodiumConsumedPre - sodiumConsumedDuring;
  
  let postElectrolytes = Math.max(0, Math.round(remainingSodiumDeficit / SACHET_SODIUM));
  
  // For endurance events (2+ hours), always recommend at least 1 sachet for recovery
  if (profile.sessionDuration >= 2 && postElectrolytes === 0) {
    postElectrolytes = 1;
  }
  
  postElectrolytes = Math.min(2, postElectrolytes); // Max 2 sachets post
  
  calculationSteps.push(`Post-activity: ${postTotal}ml total (${postImmediate}ml within 30min), ${postElectrolytes} sachet(s)`);

  // ====== 6. RECOMMENDATIONS ======
  const recommendations: string[] = [];
  
  if (isRaceDay) {
    recommendations.push(`🏁 RACE DAY: Intensity is higher, sweat rate increases, margin for error shrinks. Pre-load sodium. Never wait until thirsty.`);
  } else {
    recommendations.push(`🏋️ TRAINING: Flexibility allowed. Test products, stress your system, build resilience.`);
  }
  
  if (rawSmartWatchData) {
    recommendations.push(`📊 AI + SMARTWATCH VERIFIED: Plan adapts to your real effort patterns.`);
  }
  
  recommendations.push(`Start hydrating 2-4 hours before. Never begin dehydrated.`);
  recommendations.push(`Drink ${Math.round(duringWaterPerHour / 4)}ml every ${frequency.toLowerCase()}. Don't wait until thirsty.`);
  
  if (avgTemp > 25) {
    recommendations.push(`High temps detected. Monitor for heat stress signs.`);
  }
  
  if (profile.sessionDuration >= 3) {
    recommendations.push(`For 3+ hour sessions, add carbs (30-60g/hr) alongside hydration.`);
  }
  
  if (profile.crampTiming && profile.crampTiming !== 'none') {
    recommendations.push(`Cramping history: Focus on consistent sodium intake—don't skip pre-loading.`);
  }

  return {
    preActivity: {
      timing: '2-4 hours before',
      water: preWater,
      electrolytes: preElectrolytes,
    },
    duringActivity: {
      waterPerHour: duringWaterPerHour,
      electrolytesPerHour: duringElectrolytesPerHour,
      frequency: frequency,
    },
    postActivity: {
      water: postTotal,
      electrolytes: postElectrolytes,
      timing: `${postImmediate}ml within 30 minutes, remainder over 2-4 hours`,
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
        pmid: '37490269',
        title: 'The Effect of Pre-Exercise Hyperhydration on Exercise Performance, Physiological Outcomes and Gastrointestinal Symptoms: A Systematic Review',
        citation: 'Sports Med. 2023 Jul 25;53(11):2111-2134',
        url: 'https://pubmed.ncbi.nlm.nih.gov/37490269/'
      },
      {
        pmid: '38695357',
        title: 'Whole body sweat rate prediction: outdoor running and cycling exercise',
        citation: 'Eur J Appl Physiol. 2024 May;124(9):2825-2840',
        url: 'https://pubmed.ncbi.nlm.nih.gov/38695357/'
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
