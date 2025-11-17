import { useState } from 'react';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { HydrationProfile } from '@/types/hydration';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
      { name: '10K', duration: 0.5, discipline: 'Running' },
      { name: 'Half Marathon', duration: 1.5, discipline: 'Running' },
      { name: 'Marathon', duration: 3.5, discipline: 'Running' },
      { name: 'Long Trail Run', duration: 6, discipline: 'Running' },
      
      // Cycling
      { name: '2h Ride', duration: 2, discipline: 'Cycling' },
      { name: '4h Ride', duration: 4, discipline: 'Cycling' },
      { name: '6h Ride', duration: 6, discipline: 'Cycling' },
      
      // Swimming
      { name: 'Pool 1h', duration: 1, discipline: 'Swimming' },
      { name: 'Open Water 1.5h', duration: 1.5, discipline: 'Swimming' },
      { name: 'Long Swim 3h', duration: 3, discipline: 'Swimming' },
      
      // Triathlon
      { name: 'Olympic Tri', duration: 2.5, discipline: 'Triathlon' },
      { name: '70.3 Tri', duration: 5.5, discipline: 'Triathlon' },
      { name: 'Ironman', duration: 11, discipline: 'Triathlon' },
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

    // Water per hour checks (discipline-specific)
    const isDiscipline = (disc: string) => scenario.discipline.includes(disc);
    
    if (isDiscipline('Swimming')) {
      if (duringWater < 200 || duringWater > 900) {
        flags.push(`Swimming water ${duringWater}ml/h out of range [200-900]`);
        severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
      }
    } else {
      if (duringWater < 300 || duringWater > 1100) {
        flags.push(`Water ${duringWater}ml/h out of range [300-1100]`);
        severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
      }
      
      // Race day checks for non-swimming
      if (scenario.isRaceDay && (scenario.sweatRate === 'medium' || scenario.sweatRate === 'high') && !isDiscipline('Swimming')) {
        if (duringWater < 600 || duringWater > 900) {
          flags.push(`Race day water ${duringWater}ml/h should be 600-900`);
          severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
        }
      }
    }

    // Pre-hydration check (ml/kg)
    const prePerKg = preWater / scenario.weight;
    if (prePerKg < 3 || prePerKg > 10) {
      flags.push(`Pre ${prePerKg.toFixed(1)}ml/kg out of range [3-10]`);
      severity = severity === 'ERROR' ? 'ERROR' : 'WARNING';
    }

    // Total water replacement check
    if (replacementRate < 0.4) {
      flags.push(`Total replacement ${(replacementRate * 100).toFixed(0)}% < 40%`);
      severity = 'ERROR';
    }
    if (replacementRate > 2.0) {
      flags.push(`Total replacement ${(replacementRate * 100).toFixed(0)}% > 200%`);
      severity = 'ERROR';
    }

    // Sachet checks
    const duringSachets = plan.duringActivity.electrolytesPerHour;
    if (duringSachets % 0.5 !== 0) {
      flags.push(`Sachets ${duringSachets}/h not whole or half number`);
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
                          (plan.duringActivity.electrolytesPerHour * scenario.duration) + 
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

  const filteredResults = results.filter(r => filter === 'ALL' || r.severity === filter);
  const errorCount = results.filter(r => r.severity === 'ERROR').length;
  const warningCount = results.filter(r => r.severity === 'WARNING').length;
  const okCount = results.filter(r => r.severity === 'OK').length;

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
            <p className="text-sm text-muted-foreground">
              Will generate {generateTestScenarios().length} test scenarios across Running, Cycling, Swimming, and Triathlon
            </p>
          </div>
          <Button onClick={runTests} disabled={isRunning} size="lg">
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </Button>
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

            <div className="flex gap-2 mb-4">
              <Button variant={filter === 'ALL' ? 'default' : 'outline'} onClick={() => setFilter('ALL')}>
                All ({results.length})
              </Button>
              <Button variant={filter === 'ERROR' ? 'default' : 'outline'} onClick={() => setFilter('ERROR')}>
                Errors ({errorCount})
              </Button>
              <Button variant={filter === 'WARNING' ? 'default' : 'outline'} onClick={() => setFilter('WARNING')}>
                Warnings ({warningCount})
              </Button>
              <Button variant={filter === 'OK' ? 'default' : 'outline'} onClick={() => setFilter('OK')}>
                OK ({okCount})
              </Button>
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
                    <th className="text-right p-2">Sachets Pre/Hr/Post</th>
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
                      <td className="p-2 text-right">{result.preSachets}/{result.duringSachetsPerHour}/{result.postSachets}</td>
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
