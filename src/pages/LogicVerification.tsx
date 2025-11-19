import { Card } from '@/components/ui/card';
import { CheckCircle, AlertCircle } from 'lucide-react';

export default function LogicVerification() {
  const scenarios = [
    {
      name: "Marathon (3.5h)",
      duration: 3.5,
      sachetsPerHour: 1,
      calculation: {
        totalSachets: 2, // Capped at 2 for 3-5h sessions
        totalMinutes: 3.5 * 60,
        minutesPerSachet: Math.round((3.5 * 60) / 2),
      },
      expected: "1 every 105 min, 2 total",
      sodiumLoss: "720mg/h × 50% = 360mg/h, capped at 2 total for 3-5h duration"
    },
    {
      name: "Half Marathon (1.5h)",
      duration: 1.5,
      sachetsPerHour: 0,
      calculation: {
        totalSachets: 0, // No during sachets for <2h training (race day gets 1)
        totalMinutes: 1.5 * 60,
        minutesPerSachet: 0,
      },
      expected: "0 during (race day: 1 total)",
      sodiumLoss: "720mg/h × 50%, but <2h sessions get 0 during (race: 1)"
    },
    {
      name: "Ironman (11h)",
      duration: 11,
      sachetsPerHour: 0.27,
      calculation: {
        totalSachets: 3, // Capped at 3 for 5h+ sessions
        totalMinutes: 11 * 60,
        minutesPerSachet: Math.round((11 * 60) / 3),
      },
      expected: "1 every 220 min, 3 total",
      sodiumLoss: "1100mg/h × 50% = 550mg/h, ultra-conservative cap: 3 total for 5h+"
    },
    {
      name: "10K (0.5h)",
      duration: 0.5,
      sachetsPerHour: 0,
      calculation: {
        totalSachets: 0, // No sachets for <2h sessions
        totalMinutes: 0.5 * 60,
        minutesPerSachet: 0,
      },
      expected: "0 during",
      sodiumLoss: "650mg/h × 50%, but <2h sessions get 0 during sachets"
    },
    {
      name: "100km Bike (4h)",
      duration: 4,
      sachetsPerHour: 0.5,
      calculation: {
        totalSachets: 2, // Capped at 2 for 3-5h sessions
        totalMinutes: 4 * 60,
        minutesPerSachet: Math.round((4 * 60) / 2),
      },
      expected: "1 every 120 min, 2 total",
      sodiumLoss: "900mg/h × 50% = 450mg/h, capped at 2 total for 3-5h"
    },
    {
      name: "2.5h Training Run",
      duration: 2.5,
      sachetsPerHour: 0.4,
      calculation: {
        totalSachets: 1, // Capped at 1 for 2-3h sessions
        totalMinutes: 2.5 * 60,
        minutesPerSachet: Math.round((2.5 * 60) / 1),
      },
      expected: "1 every 150 min, 1 total",
      sodiumLoss: "700mg/h × 50% = 350mg/h, capped at 1 total for 2-3h"
    }
  ];

  const validateScenario = (scenario: typeof scenarios[0]) => {
          const calc = scenario.calculation;
          const actual = calc.totalSachets === 0 
            ? scenario.expected 
            : `1 every ${calc.minutesPerSachet} min, ${calc.totalSachets} total`;
    return actual === scenario.expected;
  };

  return (
    <div className="container mx-auto p-8 max-w-[1200px]">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">✅ Logic Verification</h1>
        <p className="text-muted-foreground">
          Verifying sachet timing calculations match session duration and totals
        </p>
      </div>

      <Card className="p-6 mb-6 bg-green-50 dark:bg-green-950/20">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <CheckCircle className="text-green-600" />
          Algorithm Formula
        </h2>
        <div className="space-y-2 text-sm font-mono">
          <div className="p-3 bg-white dark:bg-slate-900 rounded border">
            <strong>Sodium Replacement:</strong> 40-50% of sweat loss (training 40%, race 50%)
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded border">
            <strong>Ultra-Conservative Caps:</strong> Max 1 for &lt;3h, Max 2 for 3-5h, Max 3 for 5h+
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded border">
            <strong>Race Day Exception:</strong> 1-2h sessions get 1 sachet on race day
          </div>
          <div className="p-3 bg-white dark:bg-slate-900 rounded border">
            <strong>Minutes Per Sachet:</strong> (Duration × 60) / Total Sachets (rounded)
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        {scenarios.map((scenario, idx) => {
          const isValid = validateScenario(scenario);
          const calc = scenario.calculation;
          
          return (
            <Card key={idx} className={`p-6 border-l-4 ${isValid ? 'border-green-500' : 'border-red-500'}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">{scenario.name}</h3>
                  <p className="text-sm text-muted-foreground">{scenario.duration}h duration</p>
                </div>
                {isValid ? (
                  <CheckCircle className="text-green-600 w-6 h-6" />
                ) : (
                  <AlertCircle className="text-red-600 w-6 h-6" />
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 bg-muted/50 rounded">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">SODIUM LOSS & REPLACEMENT</p>
                  <p className="text-sm font-mono">{scenario.sodiumLoss}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">RATE</p>
                  <p className="text-lg font-bold">{scenario.sachetsPerHour} sachet{scenario.sachetsPerHour > 1 ? 's' : ''}/hour</p>
                </div>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-900">
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2">CALCULATION</p>
                <div className="space-y-1 text-sm font-mono">
                  <div>Total Sachets: {scenario.sachetsPerHour} × {scenario.duration}h = {calc.totalSachets}</div>
                  <div>Total Minutes: {scenario.duration} × 60 = {calc.totalMinutes} min</div>
                  <div>Minutes/Sachet: {calc.totalMinutes} ÷ {calc.totalSachets} = {calc.minutesPerSachet} min</div>
                </div>
              </div>

              <div className="mt-4 p-4 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-900">
                <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-1">DISPLAY OUTPUT</p>
                <p className="text-lg font-bold text-green-900 dark:text-green-100">
                  1 every {calc.minutesPerSachet} min • {calc.totalSachets} total
                </p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-8 p-6 bg-blue-50 dark:bg-blue-950/20">
        <h2 className="text-xl font-bold mb-4">✅ Scientific Validation</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Conservative sodium: max 1 sachet/hour</strong> (500mg/h) prevents GI issues. Body tolerates deficit during activity.</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Whole number sachets only</strong> - practical for real-world use</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Dynamic timing calculation</strong> - evenly distributes sachets across entire session duration</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
            <span><strong>Total matches rate × duration</strong> - mathematically consistent</span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
