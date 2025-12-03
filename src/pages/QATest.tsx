import { useState, useEffect as React_useEffect } from 'react';
import * as React from 'react';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { HydrationProfile } from '@/types/hydration';
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
}

interface TestResult extends TestScenario {
  preWater: number;
  duringWaterPerHour: number;
  postWater: number;
  totalWater: number;
  preSachets: number;
  duringSachetsPerHour: number;
  postSachets: number;
  totalSachets: number;
  sweatLoss: number;
  flags: string[];
  severity: 'OK' | 'WARNING' | 'ERROR';
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
    // Allow high percentages for ultra-short low-sweat edge cases (small denominator effect)
    if (replacementRate < 0.35) {
      flags.push(`Total replacement ${(replacementRate * 100).toFixed(0)}% < 35%`);
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
    // Use effective duration (excluding last 30 min) like the calculator does
    const effectiveDuration = Math.max(0, scenario.duration - 0.5);
    const expectedTotalDuring = expectedSachetsPerHour * effectiveDuration;
    
    // Allow some tolerance (±50% or ±1) for rounding and edge cases
    const tolerance = Math.max(1, expectedTotalDuring * 0.5);
    if (Math.abs(totalDuringSachets - expectedTotalDuring) > tolerance + 0.5) {
      flags.push(`Total during-sachets ${totalDuringSachets} vs expected ~${expectedTotalDuring.toFixed(1)} (tolerance ±${tolerance.toFixed(1)})`);
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
        crampTiming: 'none',
        primaryGoal: 'performance',
        raceDistance: scenario.isRaceDay ? scenario.discipline : undefined,
      };

      const smartwatchData = scenario.hasSmartwatch ? { hrDrift: 8 } : undefined;
      const plan = calculateHydrationPlan(profile, smartwatchData);
      const validation = validateResult(scenario, plan);

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
        postSachets: plan.postActivity.electrolytes,
        totalSachets,
        sweatLoss: plan.totalFluidLoss,
        flags: validation.flags,
        severity: validation.severity,
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
    <div className="container mx-auto p-8 max-w-[1400px]">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🧪 Hydration Algorithm QA Test Suite</h1>
        <p className="text-muted-foreground">Stress-testing the calculator across all disciplines without modifying production logic</p>
      </div>

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">Test Controls</h2>
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
          <Card className="p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Summary</h2>
            <div className="grid grid-cols-4 gap-4 mb-6">
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
                      {result.sex} {result.weight}kg • {result.discipline} {result.duration}h • {result.sweatRate}/{result.sweatSaltiness} sweat •
                      {result.tempMin}-{result.tempMax}°C {result.sunExposure} • {result.isRaceDay ? 'RACE' : 'TRAIN'}
                    </div>
                    <div className="text-red-700 dark:text-red-300">→ {result.flags.join(' | ')}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Test Results ({filteredResults.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">ID</th>
                    <th className="text-left p-2">Discipline</th>
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
                        {result.preSachets}/{Math.round(result.duringSachetsPerHour * result.duration)}/{result.postSachets}
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
