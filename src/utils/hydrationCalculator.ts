import { HydrationProfile, HydrationPlan } from '@/types/hydration';

export function calculateHydrationPlan(profile: HydrationProfile, rawSmartWatchData?: any): HydrationPlan {
  console.log('🧮 Calculating hydration plan with session duration:', profile.sessionDuration, 'hours');
  
  // 1. Estimate sweat rate based on temperature
  const avgTemp = (profile.trainingTempRange.min + profile.trainingTempRange.max) / 2;
  let sweatRatePerHour = 800; // Base: 0.8 L/hour (moderate 18-25°C)
  
  if (avgTemp < 18) {
    sweatRatePerHour = 600; // Cool: 0.6 L/hour
  } else if (avgTemp >= 18 && avgTemp <= 25) {
    sweatRatePerHour = 800; // Moderate: 0.8 L/hour
  } else if (avgTemp > 25) {
    sweatRatePerHour = 1100; // Hot: 1.0-1.2 L/hour (average 1.1)
  }

  // 2. Adjust by sport type
  const primaryDiscipline = profile.disciplines?.[0] || '';
  const sportAdjustments: { [key: string]: number } = {
    'Running': 0.10,      // +10%
    'Triathlon': 0.10,    // +10%
    'Cycling': 0,         // baseline
    'Swimming': -0.15,    // -15%
    'Gym': -0.20,         // -20%
    'CrossFit': -0.20,    // -20% (strength training)
    'Walking': -0.20,     // -20%
    'Hiking': -0.20,      // -20%
  };

  const sportAdjustment = sportAdjustments[primaryDiscipline] || 0;
  sweatRatePerHour = Math.round(sweatRatePerHour * (1 + sportAdjustment));

  // Store calculation details
  const calculationSteps: string[] = [];
  calculationSteps.push(`Base sweat rate: ${sweatRatePerHour}ml/hour (temp: ${avgTemp}°C, sport: ${primaryDiscipline})`);

  // 3. Calculate total fluid loss
  const totalFluidLoss = sweatRatePerHour * profile.sessionDuration;
  console.log(`💧 Total fluid loss: ${sweatRatePerHour}ml/hr × ${profile.sessionDuration}hr = ${totalFluidLoss}ml`);
  calculationSteps.push(`Total fluid loss: ${sweatRatePerHour}ml/hr × ${profile.sessionDuration}hr = ${totalFluidLoss}ml`);

  // 4. PRE-activity hydration: Base 5-7ml per kg bodyweight (ACSM guidelines), adjusted for conditions
  // Using 6ml/kg as baseline (middle of 5-7ml/kg range)
  let preWaterBase = profile.weight * 6; // 6ml per kg base (ACSM: 5-7 ml/kg, 2-4 hours before)
  let preAdjustmentFactor = 1.0;
  const preAdjustments: string[] = [];

  // Temperature adjustment
  if (avgTemp > 25) {
    preAdjustmentFactor += 0.20; // +20% for hot conditions
    preAdjustments.push('hot conditions (+20%)');
  } else if (avgTemp < 18) {
    preAdjustmentFactor -= 0.10; // -10% for cool conditions
    preAdjustments.push('cool conditions (-10%)');
  }

  // Sport type adjustment (high intensity sports need more pre-loading)
  if (primaryDiscipline === 'Running' || primaryDiscipline === 'Triathlon') {
    preAdjustmentFactor += 0.15; // +15% (higher cardiovascular demand)
    preAdjustments.push(`${primaryDiscipline} (+15%)`);
  } else if (primaryDiscipline === 'Swimming') {
    preAdjustmentFactor -= 0.15; // -15% (less pre-loading needed in water)
    preAdjustments.push('swimming (-15%)');
  }

  // Session duration adjustment (longer sessions need more pre-loading)
  if (profile.sessionDuration >= 3) {
    preAdjustmentFactor += 0.25; // +25% for long sessions (>3 hours)
    preAdjustments.push('long session 3+ hrs (+25%)');
  } else if (profile.sessionDuration >= 2) {
    preAdjustmentFactor += 0.15; // +15% for medium sessions (2-3 hours)
    preAdjustments.push('medium session 2-3 hrs (+15%)');
  }

  // Altitude adjustment (increased fluid loss at altitude)
  if (profile.altitude === 'high') {
    preAdjustmentFactor += 0.15; // +15%
    preAdjustments.push('high altitude (+15%)');
  } else if (profile.altitude === 'moderate') {
    preAdjustmentFactor += 0.10; // +10%
    preAdjustments.push('moderate altitude (+10%)');
  }

  // Sun exposure adjustment
  if (profile.sunExposure === 'full-sun') {
    preAdjustmentFactor += 0.10; // +10%
    preAdjustments.push('full sun (+10%)');
  }

  const preWater = Math.round(preWaterBase * preAdjustmentFactor);
  const preElectrolytes = 1; // 1 sachet (standard)

  calculationSteps.push(`Pre-activity base: ${preWaterBase}ml (${profile.weight}kg × 6ml/kg, ACSM guideline: 5-7ml/kg)`);
  if (preAdjustments.length > 0) {
    calculationSteps.push(`Pre-activity adjustments: ${preAdjustments.join(', ')} = ${Math.round((preAdjustmentFactor - 1) * 100)}% total`);
  }
  calculationSteps.push(`Pre-activity total: ${preWater}ml + ${preElectrolytes} sachet`);

  // 5. DURING-activity hydration: Replace 60-80% of fluid loss (use 70% average)
  const duringWater = Math.round(sweatRatePerHour * 0.70); // 70% replacement per hour
  
  // DURING sachets: Base 1 per hour, adjusted by sweat profile
  let duringElectrolytes = 1; // Base: 1 sachet per hour
  
  // Adjust based on sweat rate and saltiness
  if (profile.sweatRate === 'high' && profile.sweatSaltiness === 'high') {
    duringElectrolytes = 2; // High sweat + high sodium = 2 sachets/hr
  } else if (profile.sweatRate === 'high' || profile.sweatSaltiness === 'high') {
    duringElectrolytes = 1.5; // One elevated factor = 1.5 sachets/hr
  } else if (profile.sweatRate === 'low' && profile.sweatSaltiness === 'low') {
    duringElectrolytes = 0.5; // Low sweat + low sodium = 0.5 sachets/hr (1 sachet per 2 hours)
  }
  // Medium sweat rate and/or medium saltiness stays at 1 sachet/hr

  // 6. POST-activity hydration: 150% of remaining fluid deficit
  // Remaining deficit = total loss - what was replaced during
  const replacedDuring = duringWater * profile.sessionDuration;
  const remainingDeficit = totalFluidLoss - replacedDuring;
  const postWater = Math.round(remainingDeficit * 1.5); // 150% of remaining deficit
  
  // POST sachets: 1 per 2L of fluid replaced
  const postElectrolytes = Math.max(1, Math.round(postWater / 2000)); // 1 per 2000ml

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
      timing: '2-4 hours before',
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
