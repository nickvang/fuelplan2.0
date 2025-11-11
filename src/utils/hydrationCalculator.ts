import { HydrationProfile, HydrationPlan } from '@/types/hydration';

export function calculateHydrationPlan(profile: HydrationProfile, rawSmartWatchData?: any): HydrationPlan {
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
  calculationSteps.push(`Total fluid loss: ${sweatRatePerHour}ml/hr × ${profile.sessionDuration}hr = ${totalFluidLoss}ml`);

  // 4. PRE-activity hydration: Base 10ml per kg bodyweight, adjusted for conditions
  let preWaterBase = profile.weight * 10; // 10ml per kg base
  let preAdjustmentFactor = 1.0;
  const preAdjustments: string[] = [];

  // Temperature adjustment
  if (avgTemp > 25) {
    preAdjustmentFactor += 0.20; // +20% for hot conditions
    preAdjustments.push('hot conditions (+20%)');
  }

  // Sport type adjustment (high intensity sports need more pre-loading)
  if (primaryDiscipline === 'Running' || primaryDiscipline === 'Triathlon') {
    preAdjustmentFactor += 0.10; // +10%
    preAdjustments.push(`${primaryDiscipline} (+10%)`);
  } else if (primaryDiscipline === 'Swimming') {
    preAdjustmentFactor -= 0.10; // -10% (less pre-loading needed)
    preAdjustments.push('swimming (-10%)');
  }

  // Session duration adjustment
  if (profile.sessionDuration >= 3) {
    preAdjustmentFactor += 0.20; // +20% for long sessions
    preAdjustments.push('long session (+20%)');
  } else if (profile.sessionDuration >= 2) {
    preAdjustmentFactor += 0.10; // +10% for medium sessions
    preAdjustments.push('medium session (+10%)');
  }

  // Altitude adjustment
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

  calculationSteps.push(`Pre-activity base: ${preWaterBase}ml (${profile.weight}kg × 10ml/kg)`);
  if (preAdjustments.length > 0) {
    calculationSteps.push(`Pre-activity adjustments: ${preAdjustments.join(', ')} = ${Math.round((preAdjustmentFactor - 1) * 100)}% total`);
  }
  calculationSteps.push(`Pre-activity total: ${preWater}ml + ${preElectrolytes} sachet`);

  // 5. DURING-activity hydration: Replace 60-80% of fluid loss (use 70% average)
  const duringWater = Math.round(sweatRatePerHour * 0.70); // 70% replacement per hour
  
  // DURING sachets: 1 per hour of activity
  const duringElectrolytes = Math.round(profile.sessionDuration); // 1 sachet per hour

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
