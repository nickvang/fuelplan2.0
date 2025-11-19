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
  
  // Calculate sodium replacement target (NOT 100% - we replace 40-50% during activity)
  // Scientific evidence shows full replacement during exercise can cause GI issues
  // Body can tolerate sodium deficit during activity and replenish post-exercise
  const sodiumReplacementRate = isRaceDay ? 0.50 : 0.40; // 50% race, 40% training
  const targetSodiumPerHour = (sweatRatePerHour / 1000) * sodiumPerLiter * sodiumReplacementRate;
  
  calculationSteps.push(`Target sodium replacement: ${Math.round(targetSodiumPerHour)}mg/h (${(sodiumReplacementRate * 100)}% of loss)`);
  
  // Calculate sachets per hour based on target replacement (not full loss)
  let sachetsPerHour = targetSodiumPerHour / SACHET_SODIUM;
  
  // Heat/intensity adjustment removed to provide more conservative recommendations
  
  // Race day adjustment - removed as it was making totals too high
  
  // Round to nearest whole number
  sachetsPerHour = Math.round(sachetsPerHour);
  
  // Ultra conservative cap: minimize sachet usage across all activities
  // Most athletes don't need as many sachets as previously recommended
  // Exception: Race day efforts need electrolytes even if shorter duration
  if (profile.sessionDuration < 2) {
    // For race day, allow 1 sachet even for sessions 1-2h
    sachetsPerHour = isRaceDay && profile.sessionDuration >= 1 ? 1 : 0;
  } else if (profile.sessionDuration < 3) {
    sachetsPerHour = Math.min(1, sachetsPerHour); // Max 1/hour for 2-3h sessions
  } else {
    sachetsPerHour = Math.min(1, sachetsPerHour); // Max 1/hour even for very long sessions
  }
  
  // Ensure whole numbers only (no decimals)
  sachetsPerHour = Math.ceil(sachetsPerHour);
  
  calculationSteps.push(`Sachets per hour: ${sachetsPerHour} (race-aware: allows 1 for race day 1-2h)`);
  
  // Calculate total during-activity sachets
  let totalDuringSachets = sachetsPerHour * profile.sessionDuration;
  
  // Since we now give 1 sachet pre-activity, reduce during by 1 to keep total reasonable
  // Ultra-conservative caps on total during-sachets
  if (profile.sessionDuration < 3) {
    totalDuringSachets = Math.max(0, Math.min(1, totalDuringSachets) - 1); // Subtract 1 for pre-sachet
  } else if (profile.sessionDuration < 5) {
    totalDuringSachets = Math.max(1, Math.min(2, totalDuringSachets) - 1); // Max 1 for 3-5h (was 2)
  } else {
    totalDuringSachets = Math.max(1, Math.min(3, totalDuringSachets) - 1); // Max 2 for 5h+ (was 3)
  }
  
  // Always round up to whole numbers
  totalDuringSachets = Math.ceil(totalDuringSachets);
  
  calculationSteps.push(`Total during-sachets: ${totalDuringSachets} (ultra-conservative caps)`);
  
  const totalSachetsNeeded = totalDuringSachets;

  // ====== 3. PRE-ACTIVITY HYDRATION ======
  // Base: 6-8ml/kg (ACSM), using 7ml/kg as baseline (reduced from 8)
  // FIX #2: Cap final result at 10ml/kg to prevent excessive pre-loading
  let preWaterBase = profile.weight * 7;
  let preAdjustmentFactor = 1.0;
  const preAdjustments: string[] = [];
  
  // FIX #5: Scale down pre-hydration for short sessions with low sweat rate
  // to prevent excessive total replacement percentages
  if (profile.sessionDuration < 1 && profile.sweatRate === 'low') {
    preAdjustmentFactor *= 0.60; // -40% for short + low sweat combo
    preAdjustments.push('short + low sweat -40%');
  } else if (profile.sessionDuration < 1) {
    preAdjustmentFactor *= 0.75; // -25% for short sessions
    preAdjustments.push('short session -25%');
  }
  
  // Temperature (reduced from +20% to +15%)
  if (avgTemp > 25) {
    preAdjustmentFactor += 0.15;
    preAdjustments.push('hot +15%');
  }
  
  // Race day or longer duration (≥75 min) - reduced from +15% to +10%
  if (isRaceDay || profile.sessionDuration >= 1.25) {
    preAdjustmentFactor += 0.10;
    preAdjustments.push(isRaceDay ? 'race day +10%' : 'duration ≥75min +10%');
  }
  
  // Session duration (very long) - reduced from +20% to +10%
  if (profile.sessionDuration >= 3) {
    preAdjustmentFactor += 0.10;
    preAdjustments.push('long session +10%');
  }
  
  // Altitude - reduced modifiers
  if (profile.altitude === 'high') {
    preAdjustmentFactor += 0.10;
    preAdjustments.push('high altitude +10%');
  } else if (profile.altitude === 'moderate') {
    preAdjustmentFactor += 0.05;
    preAdjustments.push('moderate altitude +5%');
  }
  
  let preWater = Math.round(preWaterBase * preAdjustmentFactor / 10) * 10; // Round to nearest 10ml
  
  // FIX #2: Hard cap at 10ml/kg (safety limit)
  const maxPreWater = profile.weight * 10;
  if (preWater > maxPreWater) {
    preWater = maxPreWater;
    preAdjustments.push(`capped at 10ml/kg`);
  }
  
  // FIX #5: For very short sessions with low sweat, cap at reasonable absolute minimum
  // to prevent excessive total replacement percentages for minimal fluid loss
  if (profile.sessionDuration < 1 && profile.sweatRate === 'low') {
    const estimatedSweatLoss = sweatRatePerHour * profile.sessionDuration;
    if (estimatedSweatLoss < 300 && preWater > 350) {
      preWater = 350; // Cap at 350ml for ultra-low loss scenarios
      preAdjustments.push('ultra-low loss cap at 350ml');
    }
  }
  
  // Always recommend 1 pre-activity sachet for cramping prevention (high citrate + magnesium)
  // Take 1-2 hours before activity
  const preElectrolytes = 1;
  
  if (preAdjustments.length > 0) {
    calculationSteps.push(`Pre-hydration adjustments: ${preAdjustments.join(', ')}`);
  }
  calculationSteps.push(`Pre-activity: ${preWater}ml water, ${preElectrolytes} sachet(s)`);

  // ====== 4. DURING-ACTIVITY HYDRATION ======
  // PRACTICAL APPROACH: Most runners don't carry much water
  // Sachets are easy to carry, water is not - adjust accordingly
  // Focus on practical hydration that matches real-world running
  let replacementRate: number;
  
  if (primaryDiscipline === 'Swimming') {
    // Swimming: minimal sweat, limited intake opportunity
    replacementRate = 0.30; // 30% for swimming
    calculationSteps.push('Swimming: 30% replacement (limited intake opportunity)');
  } else if (profile.sessionDuration > 2.5) {
    // Long runs: More likely to have hydration support/aid stations
    replacementRate = 0.35; // 35% for long runs
    calculationSteps.push('Long run: 35% replacement (aid station support expected)');
  } else if (profile.sessionDuration > 1.5) {
    // Medium runs: Might carry small bottle
    replacementRate = 0.30; // 30% for medium runs
    calculationSteps.push('Medium run: 30% replacement (limited water carrying capacity)');
  } else {
    // Short runs: Most runners don't carry water
    replacementRate = 0.25; // 25% for short runs
    calculationSteps.push('Short run: 25% replacement (most runners carry no water)');
  }
  
  let duringWaterPerHour = Math.round((sweatRatePerHour * replacementRate) / 10) * 10;
  
  // Practical minimums and maximums based on carrying capacity
  if (profile.sessionDuration < 1) {
    // < 1 hour: Most don't carry water at all
    if (duringWaterPerHour > 300) {
      duringWaterPerHour = 300; // Max 300ml/h for short runs
      calculationSteps.push('Short run: capped at 300ml/h (impractical to carry more)');
    }
    duringWaterPerHour = Math.max(200, duringWaterPerHour);
  } else if (profile.sessionDuration < 2) {
    // 1-2 hours: Small handheld flask typical
    if (duringWaterPerHour > 400) {
      duringWaterPerHour = 400; // Max 400ml/h for medium runs
      calculationSteps.push('Medium run: capped at 400ml/h (handheld flask capacity)');
    }
    duringWaterPerHour = Math.max(250, duringWaterPerHour);
  } else {
    // 2+ hours: Hydration vest or aid stations
    if (duringWaterPerHour > 500) {
      duringWaterPerHour = 500; // Max 500ml/h for long runs
      calculationSteps.push('Long run: capped at 500ml/h (practical with vest/aid stations)');
    }
    duringWaterPerHour = Math.max(300, duringWaterPerHour);
  }
  
  // Swimming-specific cap
  if (primaryDiscipline === 'Swimming') {
    if (duringWaterPerHour > 300) {
      duringWaterPerHour = 300;
      calculationSteps.push('Swimming capped at 300ml/h (practical limit)');
    }
  }
  
  const duringElectrolytesPerHour = Math.ceil(totalDuringSachets / profile.sessionDuration);
  
  calculationSteps.push(`During-activity: ${duringWaterPerHour}ml/h (${(replacementRate * 100).toFixed(0)}% replacement), ${totalDuringSachets} total sachet(s)`);
  
  // Frequency guidance
  let frequency = 'Every 15-20 minutes';
  if (profile.sessionDuration >= 2) {
    frequency = 'Every 12-15 minutes';
  }

  // ====== 5. POST-ACTIVITY HYDRATION ======
  // SAFETY FIRST: Prevent dangerous rapid rehydration
  // Safe rehydration rate: max 800-1000ml per hour
  // Initial 30min: max 400ml (safe gastric emptying rate)
  
  const totalConsumedDuring = duringWaterPerHour * profile.sessionDuration;
  const remainingDeficit = totalFluidLoss - totalConsumedDuring;
  
  // Immediate intake (first 30 min): SAFE MAXIMUM 400ml
  // Prevents hyponatremia and GI distress
  let postImmediate = Math.min(400, Math.round((remainingDeficit * 0.30) / 10) * 10);
  
  // Ensure reasonable minimum for short sessions
  if (postImmediate < 200 && remainingDeficit > 500) {
    postImmediate = 200;
  }
  
  calculationSteps.push(`Post immediate (30min): ${postImmediate}ml (safe rate: max 400ml/30min)`);
  
  // Total recovery over 2-4 hours: more conservative - aim for 100% of remaining deficit
  // Reduced from 125% to prevent excessive post-activity hydration recommendations
  let postTotal = Math.round((remainingDeficit * 1.0) / 10) * 10;
  
  // Conservative cap: max 1500ml over 2-4h (prevents excessive recommendations)
  postTotal = Math.min(1500, postTotal);
  
  calculationSteps.push(`Post total (2-4h): ${postTotal}ml steady pace (conservative cap: 1500ml max)`);
  
  // Sodium: remaining deficit
  const sodiumConsumedDuring = totalDuringSachets * SACHET_SODIUM;
  const sodiumConsumedPre = preElectrolytes * SACHET_SODIUM;
  const remainingSodiumDeficit = totalSodiumLoss - sodiumConsumedPre - sodiumConsumedDuring;
  
  let postElectrolytes = Math.ceil(Math.max(0, remainingSodiumDeficit / SACHET_SODIUM));
  
  // More balanced post-activity sodium recommendations
  // Allow up to 2 sachets for race efforts, 1 for training
  postElectrolytes = Math.min(isRaceDay ? 2 : 1, postElectrolytes);
  
  // Minimum 1 post-sachet for longer sessions (≥3h)
  if (profile.sessionDuration >= 3 && postElectrolytes === 0) {
    postElectrolytes = 1;
  }
  
  calculationSteps.push(`Post-activity: ${postTotal}ml total (${postImmediate}ml within 30min), ${postElectrolytes} sachet(s) (race-aware)`);

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
