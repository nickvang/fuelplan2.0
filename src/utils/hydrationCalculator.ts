import { HydrationProfile, HydrationPlan, SUPPLME_ELECTROLYTE_SPEC } from '@/types/hydration';
import { getTriathlonSegmentPlan } from '@/utils/triathlonCalculator';

export function calculateHydrationPlan(profile: HydrationProfile, rawSmartWatchData?: any): HydrationPlan {
  if (import.meta.env.DEV) {
    console.log('🧮 Advanced hydration calculation starting...', {
      duration: profile.sessionDuration,
      weight: profile.weight,
      discipline: profile.disciplines?.[0],
      hasSmartwatch: !!rawSmartWatchData
    });
  }

  // CRITICAL: Validate and normalize inputs to prevent NaN values
  let sessionDuration = Number(profile.sessionDuration);
  if (!sessionDuration || !isFinite(sessionDuration) || sessionDuration <= 0) {
    if (import.meta.env.DEV) console.warn('⚠️ Invalid or missing sessionDuration, defaulting to 1 hour:', profile.sessionDuration);
    sessionDuration = 1;
  }
  (profile as any).sessionDuration = sessionDuration;

  let weight = Number(profile.weight);
  if (!weight || !isFinite(weight) || weight <= 0) {
    if (import.meta.env.DEV) console.warn('⚠️ Invalid or missing weight, defaulting to 70kg:', profile.weight);
    weight = 70;
  }
  (profile as any).weight = weight;
  
  const calculationSteps: string[] = [];
  const isRaceDay = profile.raceDistance && profile.raceDistance.length > 0;
  
  // ====== 1. SWEAT RATE CALCULATION (Updated Formula) ======
  const avgTemp = (profile.trainingTempRange.min + profile.trainingTempRange.max) / 2;
  const primaryDiscipline = profile.disciplines?.[0] || '';
  
  // Base sweat rates (L/h ranges from new formula)
  // Low: 0.4–0.7 L/h, Medium: 0.8–1.2 L/h, High: 1.3–2.0 L/h
  const baseSweatRates: { [key: string]: number } = {
    'low': 550,       // 0.55 L/h (midpoint of 0.4-0.7)
    'medium': 1000,   // 1.0 L/h (midpoint of 0.8-1.2)
    'high': 1650,     // 1.65 L/h (midpoint of 1.3-2.0)
    'very-high': 2000 // 2.0 L/h (extreme sweaters)
  };
  
  let sweatRatePerHour = baseSweatRates[profile.sweatRate] || 1000;
  calculationSteps.push(`Base sweat rate: ${sweatRatePerHour}ml/h (${profile.sweatRate} sweater)`);
  
  // Modifiers for sweat rate
  let sweatModifier = 1.0;
  const sweatAdjustments: string[] = [];
  
  // Temperature adjustment
  if (avgTemp > 30) {
    sweatModifier += 0.30;
    sweatAdjustments.push('extreme heat +30%');
  } else if (avgTemp > 25) {
    sweatModifier += 0.20;
    sweatAdjustments.push('hot +20%');
  } else if (avgTemp < 15) {
    sweatModifier -= 0.10;
    sweatAdjustments.push('cool -10%');
  }
  
  // Body size adjustment
  if (profile.weight < 60) {
    sweatModifier -= 0.10;
    sweatAdjustments.push('body <60kg -10%');
  } else if (profile.weight > 80) {
    sweatModifier += 0.10;
    sweatAdjustments.push('body >80kg +10%');
  }
  
  // Sun exposure
  if (profile.sunExposure === 'full-sun') {
    sweatModifier += 0.20;
    sweatAdjustments.push('full sun +20%');
  } else if (profile.sunExposure === 'partial') {
    sweatModifier += 0.10;
    sweatAdjustments.push('partial sun +10%');
  }

  // Smartwatch HR drift (indicates dehydration/high stress)
  if (rawSmartWatchData?.hrDrift && rawSmartWatchData.hrDrift > 5) {
    sweatModifier += 0.15;
    sweatAdjustments.push('HR drift >5% +15%');
  } else if (!rawSmartWatchData?.hrDrift && (profile as any).hrProfile && primaryDiscipline && profile.age && profile.age > 0) {
    // Strava-based HR intensity refinement when no live HR drift is available.
    const hrProfile = (profile as any).hrProfile as Record<string, { average?: number }>;
    const hrInfo = hrProfile[primaryDiscipline];
    const avgHR = typeof hrInfo?.average === 'number' ? hrInfo.average : null;
    if (avgHR && avgHR > 80 && avgHR < 210) {
      const estMax = 220 - profile.age;
      if (estMax > 100) {
        const intensity = avgHR / estMax; // 0.6–0.9 typical endurance zone
        if (intensity >= 0.85) {
          sweatModifier += 0.08;
          sweatAdjustments.push(`high HR intensity (${Math.round(avgHR)}bpm ≈ ${(intensity * 100).toFixed(0)}% HRmax) +8%`);
        } else if (intensity >= 0.75) {
          sweatModifier += 0.04;
          sweatAdjustments.push(`moderate HR intensity (${Math.round(avgHR)}bpm ≈ ${(intensity * 100).toFixed(0)}% HRmax) +4%`);
        } else if (intensity < 0.65) {
          sweatModifier -= 0.04;
          sweatAdjustments.push(`low HR intensity (${Math.round(avgHR)}bpm ≈ ${(intensity * 100).toFixed(0)}% HRmax) -4%`);
        }
      }
    }
  }

  // Sport-specific adjustment
  const sportAdjustments: { [key: string]: number } = {
    'Running': 0.10,
    'Triathlon': 0.10,
    'Cycling': 0,
    'Swimming': -0.15,
    'Gym': -0.20,
    'CrossFit': -0.10,
    'Walking': -0.20
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


  // ====== 2. SODIUM LOSS & SACHETS CALCULATION (NEW FORMULA) ======
  // Product: Supplme Electrolyte — Sodium 500mg, Potassium 250mg, Citrate 1380mg, Chloride 230mg, Magnesium 100mg (see SUPPLME_ELECTROLYTE_SPEC).
  // Safety: Caps below respect Mg (≤200mg/h), total Na/K load, and avoid overdose (see individualMaxSachets & MAX_SACHETS_PER_HOUR).
  
  // Sodium loss per hour: use known value from sweat test if provided, else from sweat saltiness
  // Low salt: 300–500 mg/hour, Medium: 500–800 mg/hour, High: 800–1400 mg/hour
  const sodiumLossPerHour: { [key: string]: number } = {
    'low': 400,       // midpoint of 300-500
    'medium': 650,    // midpoint of 500-800
    'high': 1100,     // midpoint of 800-1400
  };

  const knownNa = profile.knownSodiumLossPerHour;
  const sodiumPerHour = (knownNa != null && Number.isFinite(knownNa) && knownNa >= 200 && knownNa <= 2000)
    ? Math.round(knownNa)
    : (sodiumLossPerHour[profile.sweatSaltiness] || 650);
  if (knownNa != null && Number.isFinite(knownNa) && knownNa >= 200 && knownNa <= 2000) {
    calculationSteps.push(`Sodium loss: using known value ${sodiumPerHour} mg/h (from sweat test / user input)`);
  }
  const totalSodiumLoss = sodiumPerHour * profile.sessionDuration;
  calculationSteps.push(`Sodium loss: ${sodiumPerHour}mg/h × ${profile.sessionDuration}h = ${Math.round(totalSodiumLoss)}mg total`);
  
  const SACHET_SODIUM = SUPPLME_ELECTROLYTE_SPEC.sodium;
  
  // ====== SACHETS PER HOUR CALCULATION (NEW FORMULA) ======
  // Base: Sachets per hour = Sodium need per hour ÷ 500
  let baseSachetsPerHour = sodiumPerHour / SACHET_SODIUM;
  calculationSteps.push(`Base sachets/hour: ${sodiumPerHour}mg ÷ ${SACHET_SODIUM}mg = ${baseSachetsPerHour.toFixed(2)}`);
  
  // Weight scaling (NEW FORMULA)
  let weightMultiplier = 0.8; // default for 65-80kg
  if (weight < 65) {
    weightMultiplier = 0.7; // midpoint of 0.6-0.8
    calculationSteps.push(`Weight <65kg: 0.7× multiplier`);
  } else if (weight >= 65 && weight <= 80) {
    weightMultiplier = 0.8; // midpoint of 0.7-0.9
    calculationSteps.push(`Weight 65-80kg: 0.8× multiplier`);
  } else if (weight > 80 && weight <= 95) {
    weightMultiplier = 0.95; // midpoint of 0.8-1.1
    calculationSteps.push(`Weight 80-95kg: 0.95× multiplier`);
  } else if (weight > 95) {
    weightMultiplier = 1.15; // midpoint of 1.0-1.3
    calculationSteps.push(`Weight >95kg: 1.15× multiplier`);
  }
  
  // Environment scaling (NEW FORMULA)
  let envMultiplier = 1.0;
  if (avgTemp < 15) {
    envMultiplier = 0.875; // -12.5% (midpoint of 10-15% reduction)
    calculationSteps.push(`Cold environment: -12.5%`);
  } else if (avgTemp >= 15 && avgTemp <= 25) {
    envMultiplier = 1.0; // neutral
    calculationSteps.push(`Neutral temperature: no adjustment`);
  } else if (avgTemp > 25 && avgTemp <= 30) {
    envMultiplier = 1.25; // +25% (midpoint of 20-30%)
    calculationSteps.push(`Hot environment: +25%`);
  } else if (avgTemp > 30) {
    // Very hot / humid: +30-50%
    const humidityBoost = profile.humidity && profile.humidity > 70 ? 0.5 : 0.4;
    envMultiplier = 1.0 + humidityBoost;
    calculationSteps.push(`Very hot/humid: +${(humidityBoost * 100).toFixed(0)}%`);
  }
  
  // Sweat rate scaling (NEW FORMULA)
  let sweatRateMultiplier = 1.0;
  if (profile.sweatRate === 'low') {
    sweatRateMultiplier = 0.8; // -20%
    calculationSteps.push(`Low sweat rate: -20%`);
  } else if (profile.sweatRate === 'medium') {
    sweatRateMultiplier = 1.0; // no change
    calculationSteps.push(`Medium sweat rate: no adjustment`);
  } else if (profile.sweatRate === 'high' || profile.sweatRate === 'very-high') {
    sweatRateMultiplier = 1.325; // +32.5% (midpoint of 25-40%)
    calculationSteps.push(`High sweat rate: +32.5%`);
  }
  
  // Apply all multipliers
  let sachetsPerHour = baseSachetsPerHour * weightMultiplier * envMultiplier * sweatRateMultiplier;
  calculationSteps.push(`Calculated sachets/hour: ${baseSachetsPerHour.toFixed(2)} × ${weightMultiplier} × ${envMultiplier} × ${sweatRateMultiplier} = ${sachetsPerHour.toFixed(2)}`);
  
  // Swimming override: No sachets during swims when racing (can't drink while swimming)
  if (primaryDiscipline === 'Swimming' && isRaceDay) {
    sachetsPerHour = 0;
    calculationSteps.push(`Swimming race: 0 sachets/hour (impractical to consume during swim)`);
  }
  
  // For endurance activities (≥2h), apply a physiological minimum floor
  // Research shows even low sweaters need sodium replacement during prolonged exercise
  // ACSM recommends 300-600mg sodium/hour for events >2h regardless of sweat profile
  // Minimum 0.5 sachets/hour ensures at least 1 sachet/hour after rounding for long events
  if (profile.sessionDuration >= 2 && sachetsPerHour < 0.5 && primaryDiscipline !== 'Swimming') {
    calculationSteps.push(`Endurance floor: ${sachetsPerHour.toFixed(2)} → 0.5 (min for 2h+ activities)`);
    sachetsPerHour = 0.5;
  }
  
  // Round to whole numbers only - no decimals
  sachetsPerHour = Math.round(sachetsPerHour);
  
  calculationSteps.push(`Sachets per hour: ${sachetsPerHour} (whole number)`);
  
  // For triathlon: no sachets can be taken during the swim — only bike + run
  let consumableHours = Math.max(0, profile.sessionDuration - 0.5);
  let estimatedSwimHours = 0;
  if (primaryDiscipline === 'Triathlon') {
    // Ironman swim ~1–1.25h; use ~12% of total time, max 1.5h
    estimatedSwimHours = Math.min(1.5, profile.sessionDuration * 0.12);
    consumableHours = Math.max(0, consumableHours - estimatedSwimHours);
    calculationSteps.push(`Triathlon: swim ~${estimatedSwimHours.toFixed(1)}h — no sachets during swim; only bike + run (${consumableHours.toFixed(1)}h consumable)`);
  }

  // Calculate total during-activity sachets
  // For activities under 2 hours: no during-sachets needed (pre + post covers it)
  // For longer activities: use consumable hours only (exclude last 30 min; for triathlon exclude swim)
  let totalDuringSachets = 0;
  
  if (profile.sessionDuration < 2) {
    totalDuringSachets = 0;
    calculationSteps.push(`Total during-sachets: 0 (activities under 2h don't need during-sachets)`);
  } else {
    const effectiveDurationForSachets = primaryDiscipline === 'Triathlon' ? consumableHours : Math.max(0, profile.sessionDuration - 0.5);
    totalDuringSachets = Math.round(sachetsPerHour * effectiveDurationForSachets);
    calculationSteps.push(`Total during-sachets: ${totalDuringSachets} (for ${effectiveDurationForSachets.toFixed(1)}h effective duration)`);
  }
  
  // ====== SAFETY CAP: Avoid overdose (Mg, Na, K considered) ======
  // Supplme Electrolyte: Sodium 500mg, Potassium 250mg, Citrate 1380mg, Chloride 230mg, Magnesium 100mg.
  //
  // Science:
  // - Mg: NIH UL for supplemental Mg = 350mg/day (laxative/GI as limiting effect). No established hourly limit
  //   during exercise; 200mg/h is a conservative acute rate to minimise GI risk → 2 sachets/h max.
  // - Total Mg from sachets over long events can exceed 350mg; we cap total sachets per day so Mg from
  //   product stays ≤ 1000mg (spread over many hours) to balance Na replacement needs with Mg safety.
  // - Na: Guidelines ~500–700mg/h during endurance; 1 sachet = 500mg → 1–1.4 sachets/h for replacement.
  //   High sweaters (800–1400mg/h loss) may need up to 2/h; we cap at 2/h for Mg and apply daily cap below.
  //
  const MAX_SACHETS_PER_HOUR = 2; // SUPPLME_ELECTROLYTE_SPEC.magnesium * 2 = 200mg Mg/h — conservative acute threshold
  const MAX_TOTAL_SACHETS_DAY = 10; // 1000mg Mg from product per day; pre+during+post ≤ this
  
  // Individualized total cap (Na/K/Mg over event; high sweaters can tolerate more replacement)
  let individualMaxSachets: number;
  
  if (profile.sweatRate === 'high' && profile.sweatSaltiness === 'high') {
    individualMaxSachets = 16; // High sweaters — max tolerance
  } else if (profile.sweatRate === 'high' || profile.sweatSaltiness === 'high') {
    individualMaxSachets = 14;
  } else if (profile.sweatRate === 'medium' || profile.sweatSaltiness === 'medium') {
    individualMaxSachets = 12; // Average (e.g. Ironman ~12 during is typical)
  } else {
    individualMaxSachets = 10;
  }
  
  if (weight < 65) {
    individualMaxSachets = Math.max(8, Math.round(individualMaxSachets * 0.75));
    calculationSteps.push(`Weight <65kg: max sachets reduced to ${individualMaxSachets}`);
  } else if (weight >= 65 && weight <= 80) {
    individualMaxSachets = Math.round(individualMaxSachets * 0.9);
    calculationSteps.push(`Weight 65-80kg: max sachets adjusted to ${individualMaxSachets}`);
  }
  
  // Mg-safe max: 2 sachets/hour × consumable hours, capped at individual max
  const mgSafeMax = Math.round(MAX_SACHETS_PER_HOUR * consumableHours);
  const finalMaxSachets = Math.min(individualMaxSachets, mgSafeMax);
  
  calculationSteps.push(`Safety cap: ${finalMaxSachets} sachets (profile max: ${individualMaxSachets}, Mg-safe: ${mgSafeMax})`);
  
  if (sachetsPerHour > MAX_SACHETS_PER_HOUR) {
    calculationSteps.push(`Hourly cap: ${sachetsPerHour} → ${MAX_SACHETS_PER_HOUR} sachets/h (Mg 200mg/h)`);
    sachetsPerHour = MAX_SACHETS_PER_HOUR;
  }
  
  if (totalDuringSachets > finalMaxSachets) {
    calculationSteps.push(`Total cap: ${totalDuringSachets} → ${finalMaxSachets} sachets (avoid electrolyte overdose)`);
    totalDuringSachets = finalMaxSachets;
  }

  // Daily Mg cap: pre + during + post ≤ MAX_TOTAL_SACHETS_DAY (1000mg Mg from product)
  const preElectrolytes = 1;
  const maxDuringFromDailyCap = MAX_TOTAL_SACHETS_DAY - preElectrolytes - 1; // reserve 1 for post
  if (totalDuringSachets > maxDuringFromDailyCap) {
    calculationSteps.push(`Daily cap: ${totalDuringSachets} → ${maxDuringFromDailyCap} during-sachets (Mg ≤${MAX_TOTAL_SACHETS_DAY * 100}mg from product)`);
    totalDuringSachets = maxDuringFromDailyCap;
  }
  
  const totalSachetsNeeded = totalDuringSachets;

  // ====== 3. PRE-ACTIVITY HYDRATION ======
  // Base: 6-8ml/kg (ACSM), using 7ml/kg as baseline
  let preWaterBase = profile.weight * 7;
  let preAdjustmentFactor = 1.0;
  const preAdjustments: string[] = [];
  
  // Scale down pre-hydration for short sessions
  if (profile.sessionDuration < 1 && profile.sweatRate === 'low') {
    preAdjustmentFactor *= 0.60;
    preAdjustments.push('short + low sweat -40%');
  } else if (profile.sessionDuration < 1) {
    preAdjustmentFactor *= 0.75;
    preAdjustments.push('short session -25%');
  }
  
  // Temperature adjustment
  if (avgTemp > 25) {
    preAdjustmentFactor += 0.15;
    preAdjustments.push('hot +15%');
  }
  
  // Race day or longer duration
  if (isRaceDay || profile.sessionDuration >= 1.25) {
    preAdjustmentFactor += 0.10;
    preAdjustments.push(isRaceDay ? 'race day +10%' : 'duration ≥75min +10%');
  }
  
  // Session duration (very long)
  if (profile.sessionDuration >= 3) {
    preAdjustmentFactor += 0.10;
    preAdjustments.push('long session +10%');
  }
  
  // Altitude
  if (profile.altitude === 'high') {
    preAdjustmentFactor += 0.10;
    preAdjustments.push('high altitude +10%');
  } else if (profile.altitude === 'moderate') {
    preAdjustmentFactor += 0.05;
    preAdjustments.push('moderate altitude +5%');
  }
  
  let preWater = Math.round(preWaterBase * preAdjustmentFactor / 10) * 10;
  
  // Hard cap at 10ml/kg
  const maxPreWater = profile.weight * 10;
  if (preWater > maxPreWater) {
    preWater = maxPreWater;
    preAdjustments.push(`capped at 10ml/kg`);
  }
  
  // For very short sessions with low sweat, cap at reasonable absolute minimum
  if (profile.sessionDuration < 1 && profile.sweatRate === 'low') {
    const estimatedSweatLoss = sweatRatePerHour * profile.sessionDuration;
    if (estimatedSweatLoss < 300 && preWater > 350) {
      preWater = 350;
      preAdjustments.push('ultra-low loss cap at 350ml');
    }
  }
  
  // Pre-activity: 1 sachet for cramping prevention (preElectrolytes set above for daily cap)
  if (preAdjustments.length > 0) {
    calculationSteps.push(`Pre-hydration adjustments: ${preAdjustments.join(', ')}`);
  }
  calculationSteps.push(`Pre-activity: ${preWater}ml water, ${preElectrolytes} sachet(s)`);

  // ====== 4. DURING-ACTIVITY HYDRATION ======
  let replacementRate: number;
  
  if (primaryDiscipline === 'Swimming') {
    replacementRate = 0.30;
    calculationSteps.push('Swimming: 30% replacement (limited intake opportunity)');
  } else if (primaryDiscipline === 'Cycling') {
    replacementRate = 0.40;
    calculationSteps.push('Cycling: 40% replacement (multiple bottle capacity)');
  } else if (profile.sessionDuration > 2.5) {
    replacementRate = 0.35;
    calculationSteps.push('Long run: 35% replacement (aid station support expected)');
  } else if (profile.sessionDuration > 1.5) {
    replacementRate = 0.30;
    calculationSteps.push('Medium run: 30% replacement (limited water carrying capacity)');
  } else {
    replacementRate = 0.25;
    calculationSteps.push('Short run: 25% replacement (most runners carry no water)');
  }
  
  let duringWaterPerHour = Math.round((sweatRatePerHour * replacementRate) / 10) * 10;
  
  // Practical minimums and maximums based on carrying capacity
  if (primaryDiscipline === 'Cycling') {
    duringWaterPerHour = Math.min(700, Math.max(400, duringWaterPerHour));
  } else if (profile.sessionDuration < 1) {
    duringWaterPerHour = Math.max(200, Math.min(300, duringWaterPerHour));
  } else if (profile.sessionDuration < 2) {
    duringWaterPerHour = Math.max(250, Math.min(400, duringWaterPerHour));
  } else {
    duringWaterPerHour = Math.max(300, Math.min(500, duringWaterPerHour));
  }
  
  // Swimming-specific adjustments
  if (primaryDiscipline === 'Swimming') {
    if (isRaceDay) {
      duringWaterPerHour = 0;
      calculationSteps.push('Swimming race: 0ml/h during (cannot drink during race)');
    } else if (profile.sessionDuration < 2) {
      duringWaterPerHour = 0;
      calculationSteps.push('Swimming <2h: 0ml/h during (impractical while swimming)');
    } else if (profile.sessionDuration < 3) {
      duringWaterPerHour = Math.min(200, duringWaterPerHour);
      calculationSteps.push('Swimming 2-3h training: max 200ml/h (pool training with breaks)');
    } else {
      duringWaterPerHour = Math.min(300, duringWaterPerHour);
      calculationSteps.push('Swimming 3h+ training: max 300ml/h (planned hydration breaks)');
    }
  }
  
  const duringElectrolytesPerHour = sachetsPerHour;
  
  calculationSteps.push(`During-activity: ${duringWaterPerHour}ml/h, ${sachetsPerHour} sachets/h, ${totalDuringSachets} total sachets`);
  
  // Frequency guidance
  let frequency = 'Every 15-20 minutes';
  if (primaryDiscipline === 'Cycling') {
    frequency = profile.sessionDuration >= 2 ? 'Every 15-20 minutes' : 'Every 20-25 minutes';
  } else if (profile.sessionDuration >= 2) {
    frequency = 'Every 12-15 minutes';
  }

  // ====== 5. POST-ACTIVITY HYDRATION ======
  const totalConsumedDuring = duringWaterPerHour * profile.sessionDuration;
  const remainingDeficit = totalFluidLoss - totalConsumedDuring;
  
  // Immediate intake (first 30 min): SAFE MAXIMUM 400ml
  let postImmediate = Math.min(400, Math.round((remainingDeficit * 0.30) / 10) * 10);
  
  if (postImmediate < 200 && remainingDeficit > 500) {
    postImmediate = 200;
  }
  
  calculationSteps.push(`Post immediate (30min): ${postImmediate}ml (safe rate: max 400ml/30min)`);
  
  // Total recovery over 2-4 hours
  let postTotal = Math.round((remainingDeficit * 1.0) / 10) * 10;
  postTotal = Math.min(1500, postTotal);
  
  calculationSteps.push(`Post total (2-4h): ${postTotal}ml (conservative cap: 1500ml max)`);
  
  // Post-activity electrolytes
  const sodiumConsumedDuring = totalDuringSachets * SACHET_SODIUM;
  const sodiumConsumedPre = preElectrolytes * SACHET_SODIUM;
  const remainingSodiumDeficit = totalSodiumLoss - sodiumConsumedPre - sodiumConsumedDuring;
  
  let postElectrolytes = Math.round(Math.max(0, remainingSodiumDeficit / SACHET_SODIUM));
  
  // More balanced post-activity sodium recommendations
  // For activities under 2h (no during-sachets), allow higher post to compensate
  if (profile.sessionDuration < 2) {
    // No during-sachets, so post can be higher to cover deficit
    postElectrolytes = Math.min(isRaceDay ? 2 : 2, postElectrolytes);
  } else {
    postElectrolytes = Math.min(isRaceDay ? 2 : 1, postElectrolytes);
  }
  
  // Minimum 1 post-sachet for longer sessions
  if (profile.sessionDuration >= 3 && postElectrolytes === 0) {
    postElectrolytes = 1;
  }

  // Cap total sachets (pre + during + post) at daily Mg limit
  const maxPostFromDailyCap = MAX_TOTAL_SACHETS_DAY - preElectrolytes - totalDuringSachets;
  if (postElectrolytes > maxPostFromDailyCap) {
    calculationSteps.push(`Daily cap: post ${postElectrolytes} → ${maxPostFromDailyCap} (total sachets ≤ ${MAX_TOTAL_SACHETS_DAY})`);
    postElectrolytes = Math.max(0, maxPostFromDailyCap);
  }
  
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
  
  // Discipline-specific drinking guidance
  if (primaryDiscipline === 'Cycling') {
    recommendations.push(`Drink ${Math.round(duringWaterPerHour / 4)}ml every ${frequency.toLowerCase()}. Easy access from bottles.`);
  } else {
    recommendations.push(`Drink ${Math.round(duringWaterPerHour / 4)}ml every ${frequency.toLowerCase()}. Don't wait until thirsty.`);
  }
  
  if (avgTemp > 25) {
    recommendations.push(`High temps detected. Monitor for heat stress signs.`);
  }
  
  if (profile.sessionDuration >= 3) {
    recommendations.push(`For 3+ hour sessions, add carbs (30-60g/hr) alongside hydration.`);
  }
  
  if (profile.crampTiming && profile.crampTiming !== 'none') {
    recommendations.push(`Cramping history: Focus on consistent sodium intake—don't skip pre-loading.`);
  }
  
  // Add critical note for ultras (4h+) as per new formula requirements
  // Add note for extreme sweaters who hit the safety cap
  if (profile.sweatRate === 'high' && profile.sweatSaltiness === 'high' && profile.sessionDuration >= 4) {
    const theoreticalSodiumNeed = sodiumPerHour * profile.sessionDuration;
    const actualSodiumFromSachets = (totalDuringSachets + preElectrolytes + postElectrolytes) * SACHET_SODIUM;
    if (theoreticalSodiumNeed > actualSodiumFromSachets * 1.5) {
      recommendations.push(`⚠️ HIGH SWEATER: Your sodium needs are elevated. Spread your SUPPLME sachets evenly throughout the event and ensure consistent intake every 30-45 minutes. For events 6h+, consider consulting a sports dietitian for personalized guidance.`);
    }
  }

  if (profile.sessionDuration >= 4) {
    recommendations.push(`⚡ Long ultras (4h+) require 300–800mg sodium/hour depending on sweat saltiness. SUPPLME delivers 500mg sodium per sachet to match physiological losses.`);
  }

  if (primaryDiscipline === 'Triathlon') {
    recommendations.push(`🏊 Triathlon: You cannot take electrolyte sachets while swimming. Your ${totalDuringSachets} during-activity sachets are for bike and run only (calculated excluding swim time). Pre-load with 1 sachet before the start; take the rest in T1, on the bike, in T2, and on the run.`);
  }

  // ====== 7. TRIATHLON SEGMENT PLAN ======
  let triathlonSegments = undefined;
  if (primaryDiscipline === 'Triathlon') {
    // Bike gets full cycling rate; run gets the running rate from duringWaterPerHour
    const bikeWaterPerHour = Math.min(700, Math.max(400, Math.round((sweatRatePerHour * 0.40) / 10) * 10));
    const runWaterPerHour = duringWaterPerHour; // already computed for running context
    const segmentPlan = getTriathlonSegmentPlan(profile, sachetsPerHour, bikeWaterPerHour, runWaterPerHour);
    if (segmentPlan) {
      triathlonSegments = segmentPlan;
      calculationSteps.push(`Triathlon segments: Swim ${Math.round(segmentPlan.swim.duration * 60)}min, T1 ${Math.round(segmentPlan.t1.duration * 60)}min, Bike ${Math.round(segmentPlan.bike.duration * 60)}min (${segmentPlan.bike.sachets} sachets, ${segmentPlan.bike.fluid}ml), T2 ${Math.round(segmentPlan.t2.duration * 60)}min, Run ${Math.round(segmentPlan.run.duration * 60)}min (${segmentPlan.run.sachets} sachets, ${segmentPlan.run.fluid}ml)`);
    }
  }

  return {
    preActivity: {
      timing: '2-4 hours before',
      water: preWater,
      electrolytes: preElectrolytes,
    },
    duringActivity: {
      waterPerHour: duringWaterPerHour,
      electrolytesPerHour: totalDuringSachets > 0 ? (sachetsPerHour || 0) : 0,
      totalElectrolytes: totalDuringSachets,
      frequency: frequency,
    },
    postActivity: {
      water: postTotal || 0,
      electrolytes: postElectrolytes || 0,
      timing: `${postImmediate}ml within 30 minutes, remainder over 2-4 hours`,
    },
    totalFluidLoss: totalFluidLoss || 0,
    triathlonSegments,
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
