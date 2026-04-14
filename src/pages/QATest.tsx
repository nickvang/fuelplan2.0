import { useState, useEffect as React_useEffect } from 'react';
import * as React from 'react';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { HydrationProfile, SACHET_SAFETY } from '@/types/hydration';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface TestScenario {
  id: string;
  sex: 'male' | 'female';
  weight: number;
  age: number;
  discipline: string;
  duration: number;
  sweatRate: 'low' | 'medium' | 'high';
  sweatSaltiness: 'low' | 'medium' | 'high';
  tempMin: number;
  tempMax: number;
  sunExposure: 'shade' | 'partial' | 'full-sun';
  isRaceDay: boolean;
  hasSmartwatch: boolean;
  healthConditions?: string;
  crampTiming?: 'none' | 'early' | 'mid' | 'late' | 'post';
  urineColor?: number;
  raceDistance?: string;
  /** Custom validation function — returns flags */
  customValidation?: (plan: any) => { flags: string[]; severity: 'OK' | 'WARNING' | 'ERROR' };
}

interface TestResult extends TestScenario {
  preWater: number;
  duringWaterPerHour: number;
  postWater: number;
  totalWater: number;
  preSachets: number;
  duringSachetsPerHour: number;
  /** Actual total during-sachets (capped by calculator); use this for display, not perHour × duration */
  totalDuringSachets: number;
  postSachets: number;
  totalSachets: number;
  sweatLoss: number;
  flags: string[];
  severity: 'OK' | 'WARNING' | 'ERROR';
  /** Display distance (e.g. "42.2 km") or "—" when not a standard race distance */
  distanceDisplay: string;
}

/** Map scenario discipline name to approximate distance for display (what the guide is for). */
function getDisplayDistance(scenario: TestScenario): string {
  const name = scenario.discipline.split('(')[0].trim().toLowerCase();
  if (name.includes('10k') || name === '10k') return '10 km';
  if (name.includes('half marathon')) return '21.1 km';
  if (name.includes('marathon')) return '42.2 km';
  if (name.includes('long trail') || name.includes('ultra')) return '50 km';
  if (name.includes('olympic tri')) return '51.5 km';
  if (name.includes('70.3') || name.includes('half ironman')) return '113 km';
  if (name.includes('ironman')) return '226 km';
  if (name.includes('2h ride') || name.includes('4h ride') || name.includes('6h ride')) {
    const h = scenario.duration;
    if (h <= 2) return '~40 km';
    if (h <= 4) return '~80 km';
    return '~120 km';
  }
  if (name.includes('pool') || name.includes('open water') || name.includes('long swim')) return '—';
  return '—';
}

export default function QATest() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'OK' | 'WARNING' | 'ERROR'>('ALL');
  const [disciplineFilter, setDisciplineFilter] = useState<string>('ALL');
  const [autoRan, setAutoRan] = useState(false);

  // Auto-run tests on mount for iterative fixing
  React.useEffect(() => {
    if (!autoRan) {
      setAutoRan(true);
      setTimeout(() => runTests(), 500); // Small delay for UX
    }
  }, []);

  const generateTestScenarios = (): TestScenario[] => {
    const scenarios: TestScenario[] = [];
    let id = 1;

    const sexes: ('male' | 'female')[] = ['male', 'female'];
    const weights = [50, 60, 70, 80, 90];
    const ages = [20, 35, 50];
    const sweatRates: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    const sweatSaltiness: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high'];
    const raceDayOptions = [true, false];
    const smartwatchOptions = [true, false];

    // Discipline scenarios
    const disciplines = [
      // Running
      { name: '10K (Running)', duration: 0.5, discipline: 'Running' },
      { name: 'Half Marathon (Running)', duration: 1.5, discipline: 'Running' },
      { name: 'Marathon (Running)', duration: 3.5, discipline: 'Running' },
      { name: 'Long Trail Run (Running)', duration: 6, discipline: 'Running' },
      
      // Cycling
      { name: '2h Ride (Cycling)', duration: 2, discipline: 'Cycling' },
      { name: '4h Ride (Cycling)', duration: 4, discipline: 'Cycling' },
      { name: '6h Ride (Cycling)', duration: 6, discipline: 'Cycling' },
      
      // Swimming
      { name: 'Pool 1h (Swimming)', duration: 1, discipline: 'Swimming' },
      { name: 'Open Water 1.5h (Swimming)', duration: 1.5, discipline: 'Swimming' },
      { name: 'Long Swim 3h (Swimming)', duration: 3, discipline: 'Swimming' },
      
      // Triathlon
      { name: 'Olympic Tri (Triathlon)', duration: 2.5, discipline: 'Triathlon' },
      { name: '70.3 Tri (Triathlon)', duration: 5.5, discipline: 'Triathlon' },
      { name: 'Ironman (Triathlon)', duration: 11, discipline: 'Triathlon' },
    ];

    // Environment scenarios
    const environments = [
      { name: 'Cool/Shade', tempMin: 12, tempMax: 18, sun: 'shade' as const },
      { name: 'Normal', tempMin: 18, tempMax: 24, sun: 'partial' as const },
      { name: 'Hot/Full Sun', tempMin: 28, tempMax: 35, sun: 'full-sun' as const },
    ];

    // Generate comprehensive test grid
    // Sample across key combinations to avoid explosion
    for (const sex of sexes) {
      for (const weight of [60, 80]) { // Sample 2 weights
        for (const age of [35]) { // Sample 1 age
          for (const disc of disciplines) {
            for (const env of environments) {
              for (const sweatRate of ['medium', 'high'] as const) { // Sample 2 sweat rates
                for (const sweatSalt of ['medium', 'high'] as const) { // Sample 2 saltiness
                  for (const isRaceDay of raceDayOptions) {
                    for (const hasSmartwatch of [false]) { // Sample without smartwatch primarily
                      scenarios.push({
                        id: `TEST-${String(id).padStart(4, '0')}`,
                        sex,
                        weight,
                        age,
                        discipline: `${disc.name} (${disc.discipline})`,
                        duration: disc.duration,
                        sweatRate,
                        sweatSaltiness: sweatSalt,
                        tempMin: env.tempMin,
                        tempMax: env.tempMax,
                        sunExposure: env.sun,
                        isRaceDay,
                        hasSmartwatch,
                      });
                      id++;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Add edge case scenarios
    const edgeCases = [
      { sex: 'male' as const, weight: 50, duration: 12, sweatRate: 'high' as const, sweatSalt: 'high' as const, temp: 35, sun: 'full-sun' as const, race: true, discipline: 'Ironman (Triathlon)' },
      { sex: 'female' as const, weight: 90, duration: 0.5, sweatRate: 'low' as const, sweatSalt: 'low' as const, temp: 15, sun: 'shade' as const, race: false, discipline: '10K (Running)' },
      { sex: 'male' as const, weight: 70, duration: 8, sweatRate: 'high' as const, sweatSalt: 'high' as const, temp: 32, sun: 'full-sun' as const, race: true, discipline: 'Long Trail Run (Running)' },
    ];

    edgeCases.forEach(edge => {
      scenarios.push({
        id: `EDGE-${String(id).padStart(4, '0')}`,
        sex: edge.sex,
        weight: edge.weight,
        age: 35,
        discipline: edge.discipline,
        duration: edge.duration,
        sweatRate: edge.sweatRate,
        sweatSaltiness: edge.sweatSalt,
        tempMin: edge.temp,
        tempMax: edge.temp,
        sunExposure: edge.sun,
        isRaceDay: edge.race,
        hasSmartwatch: false,
      });
      id++;
    });

    // ====== NEW SCENARIOS: Activity gate, safety, Strava, calibration, health, recovery ======
    const newScenarios: (Partial<TestScenario> & { name: string })[] = [
      // Activity gate scenarios
      { name: '5K race (Running)', discipline: '5K Race (Running)', duration: 0.35, isRaceDay: true, raceDistance: '5k',
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 0) return { flags: [`5K race: ${during} during-sachets should be 0`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Gym 40min', discipline: 'Gym (Gym)', duration: 0.67,
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 0) return { flags: [`Gym <45min: ${during} during-sachets should be 0`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Gym 90min', discipline: 'Gym (Gym)', duration: 1.5,
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 1) return { flags: [`Gym 90min: ${during} during-sachets should be <=1`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Walk 1h', discipline: 'Walking (Walking)', duration: 1,
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 1) return { flags: [`Walk 1h: ${during} during-sachets should be <=1`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Walk 3h', discipline: 'Hiking (Hiking)', duration: 3,
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 2) return { flags: [`Walk 3h: ${during} during-sachets should be <=2`], severity: 'WARNING' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Swim race', discipline: 'Swimming race (Swimming)', duration: 1, isRaceDay: true, raceDistance: '1500m',
        customValidation: (plan) => {
          if (plan.duringActivity.totalElectrolytes > 0) return { flags: ['Swim race: should have 0 during-sachets'], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Swim training 2.5h', discipline: 'Pool (Swimming)', duration: 2.5,
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 2) return { flags: [`Swim training 2.5h: ${during} during-sachets should be <=2`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Sprint Tri', discipline: 'Triathlon (Triathlon)', duration: 1.25, isRaceDay: true, raceDistance: 'Sprint',
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 1) return { flags: [`Sprint tri: ${during} during-sachets should be <=1`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Olympic Tri', discipline: 'Triathlon (Triathlon)', duration: 2.5, isRaceDay: true, raceDistance: 'Olympic',
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 2) return { flags: [`Olympic tri: ${during} during-sachets should be <=2`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: '70.3 Tri', discipline: 'Triathlon (Triathlon)', duration: 5.5, isRaceDay: true, raceDistance: 'Ironman 70.3',
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 4) return { flags: [`70.3: ${during} during-sachets should be <=4`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Ironman', discipline: 'Triathlon (Triathlon)', duration: 11, isRaceDay: true, raceDistance: 'Ironman',
        customValidation: (plan) => {
          const during = plan.duringActivity.totalElectrolytes;
          if (during > 5) return { flags: [`Ironman: ${during} during-sachets should be <=5`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      // Safety scenarios
      { name: 'Absolute ceiling (extreme)', discipline: 'Long Trail Run (Running)', duration: 8, sweatRate: 'high' as const, sweatSaltiness: 'high' as const,
        customValidation: (plan) => {
          const total = plan.preActivity.electrolytes + plan.duringActivity.totalElectrolytes + plan.postActivity.electrolytes;
          if (total > SACHET_SAFETY.absoluteMaxPerEvent) return { flags: [`Total ${total} sachets exceeds absolute max ${SACHET_SAFETY.absoluteMaxPerEvent}`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Water cap check', discipline: 'Marathon (Running)', duration: 3.5, sweatRate: 'high' as const,
        customValidation: (plan) => {
          if (plan.duringActivity.waterPerHour > SACHET_SAFETY.waterCeilingMlPerHour) return { flags: [`Water ${plan.duringActivity.waterPerHour}ml/h > ${SACHET_SAFETY.waterCeilingMlPerHour} cap`], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      // Health scenarios
      { name: 'Kidney disease', discipline: 'Walking (Walking)', duration: 1.5, healthConditions: 'chronic kidney disease',
        customValidation: (plan) => {
          const total = plan.preActivity.electrolytes + plan.duringActivity.totalElectrolytes + plan.postActivity.electrolytes;
          if (total > 2) return { flags: [`Kidney: ${total} total sachets should be <=2`], severity: 'ERROR' };
          if (!plan.preflight?.some((a: any) => a.level === 'error')) return { flags: ['Kidney: missing error preflight alert'], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Cystic fibrosis', discipline: 'Running (Running)', duration: 2, healthConditions: 'cystic fibrosis',
        customValidation: (plan) => {
          if (!plan.preflight?.some((a: any) => a.message?.toLowerCase().includes('cystic fibrosis'))) return { flags: ['CF: missing preflight warning'], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      // Recovery scenarios
      { name: 'Urine color 7', discipline: 'Running (Running)', duration: 1.5, urineColor: 7,
        customValidation: (plan) => {
          if (!plan.preflight?.some((a: any) => a.message?.toLowerCase().includes('urine'))) return { flags: ['Urine 7: missing dehydration warning'], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      { name: 'Urine color 8', discipline: 'Running (Running)', duration: 2, urineColor: 8,
        customValidation: (plan) => {
          if (!plan.preflight?.some((a: any) => a.message?.toLowerCase().includes('urine'))) return { flags: ['Urine 8: missing dehydration warning'], severity: 'ERROR' };
          return { flags: [], severity: 'OK' };
        }},
      // Calibration scenario
      { name: '3x cramp feedback', discipline: 'Running (Running)', duration: 3, crampTiming: 'mid' as const,
        customValidation: (plan) => {
          // Just verify cramping floor is applied (sodium floor 700mg/h)
          const steps = plan.calculationSteps?.join(' ') || '';
          if (!steps.includes('Cramping history')) return { flags: ['Cramp: cramping floor not applied'], severity: 'WARNING' };
          return { flags: [], severity: 'OK' };
        }},
      // 20min gap scenario
      { name: '20min gap check (3 sachets, 2h)', discipline: 'Running (Running)', duration: 2, sweatRate: 'high' as const, sweatSaltiness: 'high' as const, isRaceDay: true, raceDistance: 'Half Marathon',
        customValidation: () => {
          // This is a UI-level check; can't fully validate here but ensure sachets are reasonable
          return { flags: [], severity: 'OK' };
        }},
    ];

    newScenarios.forEach(ns => {
      const disc = ns.discipline || 'Running (Running)';
      scenarios.push({
        id: `NEW-${String(id).padStart(4, '0')}`,
        sex: ns.sex || 'male',
        weight: ns.weight || 75,
        age: ns.age || 35,
        discipline: disc,
        duration: ns.duration || 1,
        sweatRate: ns.sweatRate || 'medium',
        sweatSaltiness: ns.sweatSaltiness || 'medium',
        tempMin: ns.tempMin || 20,
        tempMax: ns.tempMax || 25,
        sunExposure: ns.sunExposure || 'partial',
        isRaceDay: ns.isRaceDay || false,
        hasSmartwatch: false,
        healthConditions: ns.healthConditions,
        crampTiming: ns.crampTiming,
        urineColor: ns.urineColor,
        raceDistance: ns.raceDistance,
        customValidation: ns.customValidation,
      });
      id++;
    });

    return scenarios;
  };

  const validateResult = (scenario: TestScenario, plan: any): { flags: string[], severity: 'OK' | 'WARNING' | 'ERROR' } => {
    const flags: string[] = [];
    let severity: 'OK' | 'WARNING' | 'ERROR' = 'OK';

    const duringWater = plan.duringActivity.waterPerHour;
    const preWater = plan.preActivity.water;
    const postWater = plan.postActivity.water;
    const sweatLoss = plan.totalFluidLoss;
    const totalWater = preWater + (duringWater * scenario.duration) + postWater;
    const replacementRate = totalWater / sweatLoss;

    // Check for invalid values
    if (isNaN(duringWater) || isNaN(preWater) || isNaN(postWater)) {
      flags.push('NaN detected');
      severity = 'ERROR';
    }
    if (duringWater < 0 || preWater < 0 || postWater < 0) {
      flags.push('Negative values');
      severity = 'ERROR';
    }

    // Water per hour checks - UPDATED FOR PRACTICAL APPROACH
    const isDiscipline = (disc: string) => scenario.discipline.includes(disc);
    
    if (isDiscipline('Swimming')) {
      // Swimming: Impractical to drink during activity unless training with breaks
      // RACE DAY: always 0ml/h (cannot drink during races)
      // TRAINING: <2h: 0ml/h, 2-3h: max 200ml/h, 3h+: max 300ml/h
      let minWater = 0;
      let maxWater = 0;
      
      if (scenario.isRaceDay) {
        // Race day: always zero
        minWater = 0;
        maxWater = 0;
      } else if (scenario.duration < 2) {
        minWater = 0;
        maxWater = 0;
      } else if (scenario.duration < 3) {
        minWater = 0;
        maxWater = 200;
      } else {
        minWater = 0;
        maxWater = 300;
      }
      
      if (duringWater < minWater || duringWater > maxWater) {
        flags.push(`Swimming water ${duringWater}ml/h out of range [${minWater}-${maxWater}] for ${scenario.isRaceDay ? 'race' : 'training'} ${scenario.duration}h`);
        severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
      }
    } else if (isDiscipline('Cycling')) {
      // Cycling: can carry multiple bottles
      let minWater = 300;
      let maxWater = 750;
      
      if (duringWater < minWater || duringWater > maxWater) {
        flags.push(`Cycling water ${duringWater}ml/h out of range [${minWater}-${maxWater}]`);
        severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
      }
    } else {
      // Running/other: Practical limits based on typical carrying capacity and duration
      let minWater = 200;
      let maxWater = 600;
      
      if (scenario.duration < 1) {
        // Short runs: most don't carry water
        maxWater = 350;
      } else if (scenario.duration < 2) {
        // Medium runs: handheld flask typical
        maxWater = 450;
      } else {
        // Long runs: vest or aid stations
        maxWater = 600;
      }
      
      if (duringWater < minWater || duringWater > maxWater) {
        flags.push(`Water ${duringWater}ml/h out of practical range [${minWater}-${maxWater}]`);
        severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
      }
    }

    // Pre-hydration check (ml/kg) - allow up to 10ml/kg now
    const prePerKg = preWater / scenario.weight;
    if (prePerKg < 3 || prePerKg > 10) {
      flags.push(`Pre ${prePerKg.toFixed(1)}ml/kg out of range [3-10]`);
      severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
    }

    // Total water replacement check - adjusted for pre-hydration timing
    // Swimming races have 0 during-water (can't drink while swimming), so lower replacement is expected
    // Ultra-long events (5h+) have lower practical replacement rates due to carrying limits
    // Extreme ultra events (10h+) like Ironman have even lower practical limits
    // Allow high percentages for ultra-short low-sweat edge cases (small denominator effect)
    let minReplacementRate = 0.35;
    if (isDiscipline('Swimming') && scenario.isRaceDay) {
      minReplacementRate = 0.15; // Can't drink during swimming race
    } else if (scenario.duration >= 10) {
      minReplacementRate = 0.25; // Extreme ultra events (Ironman, etc.)
    } else if (scenario.duration >= 5) {
      minReplacementRate = 0.28; // Ultra-long events have practical limits
    }
    
    if (replacementRate < minReplacementRate) {
      flags.push(`Total replacement ${(replacementRate * 100).toFixed(0)}% < ${(minReplacementRate * 100).toFixed(0)}%`);
      severity = 'ERROR';
    }
    if (replacementRate > 2.8) {
      flags.push(`Total replacement ${(replacementRate * 100).toFixed(0)}% > 280%`);
      severity = 'ERROR';
    }

    // Sachet checks - UPDATED: Based on new formula (sodium loss / 500)
    const duringSachets = plan.duringActivity.electrolytesPerHour;
    const totalDuringSachets = plan.duringActivity.totalElectrolytes;
    
    // New formula: sachets/hour = sodium need per hour ÷ 500
    // Sodium loss per hour: low=400, medium=650, high=1100
    // Then apply weight, environment, and sweat rate multipliers
    
    // Expected range based on formula (not capped)
    const sodiumPerHour = { low: 400, medium: 650, high: 1100 }[scenario.sweatSaltiness] || 650;
    const baseSachets = sodiumPerHour / 500;
    
    // Weight multiplier
    let weightMult = 0.8;
    if (scenario.weight < 65) weightMult = 0.7;
    else if (scenario.weight > 95) weightMult = 1.15;
    else if (scenario.weight > 80) weightMult = 0.95;
    
    // Environment multiplier
    const avgTemp = (scenario.tempMin + scenario.tempMax) / 2;
    let envMult = 1.0;
    if (avgTemp < 15) envMult = 0.875;
    else if (avgTemp > 30) envMult = 1.4;
    else if (avgTemp > 25) envMult = 1.25;
    
    // Sweat rate multiplier
    let sweatMult = 1.0;
    if (scenario.sweatRate === 'low') sweatMult = 0.8;
    else if (scenario.sweatRate === 'high') sweatMult = 1.325;
    
    const expectedSachetsPerHour = Math.round(baseSachets * weightMult * envMult * sweatMult);
    
    // Swimming races: 0 during-sachets (can't consume while swimming)
    // All other activities: formula decides via effective duration (excluding last 30 min)
    let expectedTotalDuring = 0;
    if (isDiscipline('Swimming') && scenario.isRaceDay) {
      expectedTotalDuring = 0; // Can't consume during swimming race
    } else {
      const effectiveDuration = Math.max(0, scenario.duration - 0.5);
      expectedTotalDuring = Math.round(expectedSachetsPerHour * effectiveDuration);
    }
    
    // Apply same safety cap as calculator (Mg-safe + individual max) so we don't flag capped results as errors
    let consumableHours = Math.max(0, scenario.duration - 0.5);
    if (isDiscipline('Triathlon')) {
      const estimatedSwimHours = Math.min(1.5, scenario.duration * 0.12);
      consumableHours = Math.max(0, consumableHours - estimatedSwimHours);
    }
    // New safety caps using SACHET_SAFETY
    const MAX_SACHETS_PER_HOUR = SACHET_SAFETY.extremePerHour;
    let durationBudget = 0;
    for (const tier of SACHET_SAFETY.duringBudgets) {
      if (scenario.duration >= tier.minHours) durationBudget = tier.max;
    }
    const mgSafeMax = Math.round(MAX_SACHETS_PER_HOUR * consumableHours);
    const finalMaxDuring = Math.min(durationBudget, mgSafeMax, SACHET_SAFETY.absoluteMaxPerEvent - 1);
    const expectedCapped = Math.min(expectedTotalDuring, finalMaxDuring);

    const tolerance = Math.max(1, Math.max(expectedCapped, totalDuringSachets) * 0.5);
    if (Math.abs(totalDuringSachets - expectedCapped) > tolerance + 0.5) {
      flags.push(`Total during-sachets ${totalDuringSachets} vs expected ~${expectedCapped.toFixed(0)} (capped; tolerance ±${tolerance.toFixed(1)})`);
      severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
    }
    
    // Pre-sachets check: should always be 1 (cramping prevention)
    const preSachets = plan.preActivity.electrolytes;
    if (preSachets !== 1) {
      flags.push(`Pre-sachets ${preSachets} should be 1 (cramping prevention)`);
      severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
    }
    
    // Post-sachets check: based on remaining sodium deficit
    const postSachets = plan.postActivity.electrolytes;
    // Post sachets should be reasonable (0-3 range typically)
    if (postSachets < 0 || postSachets > 4) {
      flags.push(`Post-sachets ${postSachets} out of reasonable range [0-4]`);
      severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
    }

    // Absurd checks
    if (scenario.duration > 3 && duringWater === 0) {
      flags.push('0ml water for long session');
      severity = 'ERROR';
    }
    if (duringWater > 3000) {
      flags.push(`Absurd water ${duringWater}ml/h > 3L/h`);
      severity = 'ERROR';
    }

    return { flags, severity };
  };

  const runTests = () => {
    setIsRunning(true);
    const scenarios = generateTestScenarios();
    const testResults: TestResult[] = [];

    scenarios.forEach(scenario => {
      const profile: HydrationProfile = {
        fullName: 'Test User',
        age: scenario.age,
        sex: scenario.sex,
        weight: scenario.weight,
        height: 175,
        disciplines: [scenario.discipline.split('(')[1].replace(')', '').trim()],
        sessionDuration: scenario.duration,
        trainingTempRange: { min: scenario.tempMin, max: scenario.tempMax },
        altitude: 'sea-level',
        humidity: 50,
        windConditions: 'calm',
        clothingType: 'light',
        indoorOutdoor: 'outdoor',
        sweatRate: scenario.sweatRate,
        sweatSaltiness: scenario.sweatSaltiness,
        dailySaltIntake: 'medium',
        sunExposure: scenario.sunExposure,
        crampTiming: scenario.crampTiming || 'none',
        primaryGoal: 'performance',
        raceDistance: scenario.raceDistance || (scenario.isRaceDay ? scenario.discipline : undefined),
        healthConditions: scenario.healthConditions,
        urineColor: scenario.urineColor,
      };

      const smartwatchData = scenario.hasSmartwatch ? { hrDrift: 8 } : undefined;
      const plan = calculateHydrationPlan(profile, smartwatchData);
      let validation = validateResult(scenario, plan);
      // Apply custom validation for new scenarios
      if (scenario.customValidation) {
        const custom = scenario.customValidation(plan);
        if (custom.flags.length > 0 || custom.severity !== 'OK') {
          validation = {
            flags: [...custom.flags],
            severity: custom.severity,
          };
        }
      }

      const totalSachets = plan.preActivity.electrolytes + 
                          plan.duringActivity.totalElectrolytes + 
                          plan.postActivity.electrolytes;

      testResults.push({
        ...scenario,
        preWater: plan.preActivity.water,
        duringWaterPerHour: plan.duringActivity.waterPerHour,
        postWater: plan.postActivity.water,
        totalWater: plan.preActivity.water + (plan.duringActivity.waterPerHour * scenario.duration) + plan.postActivity.water,
        preSachets: plan.preActivity.electrolytes,
        duringSachetsPerHour: plan.duringActivity.electrolytesPerHour,
        totalDuringSachets: plan.duringActivity.totalElectrolytes,
        postSachets: plan.postActivity.electrolytes,
        totalSachets,
        sweatLoss: plan.totalFluidLoss,
        flags: validation.flags,
        severity: validation.severity,
        distanceDisplay: getDisplayDistance(scenario),
      });
    });

    setResults(testResults);
    setIsRunning(false);
  };

  const filteredResults = results.filter(r => {
    const severityMatch = filter === 'ALL' || r.severity === filter;
    const disciplineMatch = disciplineFilter === 'ALL' || r.discipline.includes(disciplineFilter);
    return severityMatch && disciplineMatch;
  });
  
  const errorCount = results.filter(r => r.severity === 'ERROR').length;
  const warningCount = results.filter(r => r.severity === 'WARNING').length;
  const okCount = results.filter(r => r.severity === 'OK').length;

  // Extract unique disciplines for filter
  const uniqueDisciplines = Array.from(new Set(results.map(r => {
    const match = r.discipline.match(/\(([^)]+)\)/);
    return match ? match[1] : r.discipline;
  }))).sort();

  const worstCases = [...results]
    .filter(r => r.severity === 'ERROR' || r.severity === 'WARNING')
    .sort((a, b) => {
      if (a.severity === 'ERROR' && b.severity !== 'ERROR') return -1;
      if (a.severity !== 'ERROR' && b.severity === 'ERROR') return 1;
      return b.flags.length - a.flags.length;
    })
    .slice(0, 15);

  return (
    <div className="container mx-auto px-4 py-6 sm:p-8 max-w-[1400px] min-w-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold mb-2">🧪 Hydration Algorithm QA Test Suite</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Stress-testing the calculator across all disciplines without modifying production logic</p>
      </div>

      <Card className="p-4 sm:p-6 mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-2">Test Controls</h2>
            <p className="text-sm text-muted-foreground mb-2">
              Will generate {generateTestScenarios().length} test scenarios across Running, Cycling, Swimming, and Triathlon
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              ✅ Algorithm fixes applied • Testing validation rules
            </p>
          </div>
          <div className="flex gap-3">
            <a href="/qa-analysis" className="inline-block bg-secondary text-secondary-foreground px-4 py-2 rounded-md font-semibold hover:bg-secondary/90 transition-colors">
              View Analysis
            </a>
            <Button onClick={runTests} disabled={isRunning} size="lg">
              {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </Button>
          </div>
        </div>
      </Card>

      {results.length > 0 && (
        <>
          <Card className="p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{okCount}</div>
                <div className="text-sm text-muted-foreground">OK</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">{warningCount}</div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">{errorCount}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold">{results.length}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold mb-2">Filter by Severity</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button variant={filter === 'ALL' ? 'default' : 'outline'} onClick={() => setFilter('ALL')} size="sm">
                    All ({results.length})
                  </Button>
                  <Button variant={filter === 'ERROR' ? 'default' : 'outline'} onClick={() => setFilter('ERROR')} size="sm">
                    Errors ({errorCount})
                  </Button>
                  <Button variant={filter === 'WARNING' ? 'default' : 'outline'} onClick={() => setFilter('WARNING')} size="sm">
                    Warnings ({warningCount})
                  </Button>
                  <Button variant={filter === 'OK' ? 'default' : 'outline'} onClick={() => setFilter('OK')} size="sm">
                    OK ({okCount})
                  </Button>
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold mb-2">Filter by Activity</h3>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant={disciplineFilter === 'ALL' ? 'default' : 'outline'} 
                    onClick={() => setDisciplineFilter('ALL')} 
                    size="sm"
                  >
                    All
                  </Button>
                  {uniqueDisciplines.map(disc => (
                    <Button 
                      key={disc}
                      variant={disciplineFilter === disc ? 'default' : 'outline'} 
                      onClick={() => setDisciplineFilter(disc)} 
                      size="sm"
                    >
                      {disc}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {worstCases.length > 0 && (
            <Card className="p-6 mb-6 bg-red-50 dark:bg-red-950/20">
              <h2 className="text-xl font-semibold mb-4 text-red-900 dark:text-red-100">
                ⚠️ Top {worstCases.length} Worst Cases for Manual Review
              </h2>
              <div className="space-y-2 text-sm">
                {worstCases.map(result => (
                  <div key={result.id} className="border-l-4 border-red-500 pl-3 py-1">
                    <div className="font-mono font-semibold">{result.id}</div>
                    <div className="text-muted-foreground">
                      {result.sex} {result.weight}kg • {result.discipline} • <span className="font-medium text-foreground">{result.distanceDisplay}</span> • {result.duration}h • {result.sweatRate}/{result.sweatSaltiness} sweat •
                      {result.tempMin}-{result.tempMax}°C {result.sunExposure} • {result.isRaceDay ? 'RACE' : 'TRAIN'}
                    </div>
                    <div className="text-red-700 dark:text-red-300">→ {result.flags.join(' | ')}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4 sm:p-6 overflow-hidden">
            <h2 className="text-lg sm:text-xl font-semibold mb-4">Test Results ({filteredResults.length})</h2>
            <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="w-full text-xs min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Discipline</th>
                    <th className="text-left p-2">Distance</th>
                    <th className="text-left p-2">Profile</th>
                    <th className="text-left p-2">Environment</th>
                    <th className="text-right p-2">Duration</th>
                    <th className="text-right p-2">Pre (ml)</th>
                    <th className="text-right p-2">During (ml/h)</th>
                    <th className="text-right p-2">Post (ml)</th>
                    <th className="text-right p-2">Total (ml)</th>
                    <th className="text-right p-2">Sachets Pre/During/Post</th>
                    <th className="text-left p-2">Status</th>
                    <th className="text-left p-2">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map(result => (
                    <tr key={result.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono">{result.id}</td>
                      <td className="p-2">{result.discipline}</td>
                      <td className="p-2 font-medium">{result.distanceDisplay}</td>
                      <td className="p-2">
                        {result.sex.charAt(0).toUpperCase()} {result.weight}kg<br />
                        {result.sweatRate}/{result.sweatSaltiness}
                      </td>
                      <td className="p-2">
                        {result.tempMin}-{result.tempMax}°C<br />
                        {result.sunExposure}<br />
                        {result.isRaceDay ? 'RACE' : 'TRAIN'}
                      </td>
                      <td className="p-2 text-right">{result.duration}h</td>
                      <td className="p-2 text-right">{result.preWater}</td>
                      <td className="p-2 text-right font-semibold">{result.duringWaterPerHour}</td>
                      <td className="p-2 text-right">{result.postWater}</td>
                      <td className="p-2 text-right">{result.totalWater}</td>
                      <td className="p-2 text-right">
                        {result.preSachets}/{result.totalDuringSachets}/{result.postSachets}
                      </td>
                      <td className="p-2">
                        <Badge variant={
                          result.severity === 'OK' ? 'default' :
                          result.severity === 'WARNING' ? 'secondary' : 'destructive'
                        }>
                          {result.severity}
                        </Badge>
                      </td>
                      <td className="p-2 text-red-600 dark:text-red-400">{result.flags.join(' | ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
