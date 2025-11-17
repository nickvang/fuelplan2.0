/**
 * Manual QA Analysis - Predicting failure patterns without running full test
 * This analyzes the algorithm logic against validation rules
 */

export interface IssuePattern {
  category: string;
  rootCause: string;
  affectedScenarios: string[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  example: any;
}

export function analyzeAlgorithmIssues(): IssuePattern[] {
  const issues: IssuePattern[] = [];

  // ISSUE 1: Pre-hydration stacking exceeds upper limit
  issues.push({
    category: 'Pre-Hydration Over-Calculation',
    rootCause: `Base formula uses 8ml/kg, then stacks multiple modifiers:
    - Hot (>25°C): +20%
    - Race day OR ≥75min: +15%  
    - Long session (≥3h): +20%
    - High altitude: +15%
    
    Example: 80kg athlete, race day, 4h, hot, high altitude:
    8ml/kg × 1.70 = 13.6ml/kg (exceeds 10ml/kg limit)
    = 1088ml pre-hydration`,
    affectedScenarios: [
      'Any race day + hot conditions',
      'Long sessions (≥3h) + hot',
      'Altitude + race day + hot',
      'Marathon/Ironman in hot weather'
    ],
    severity: 'HIGH',
    example: {
      weight: 80,
      conditions: 'Race day + 30°C + 4h + high altitude',
      calculated: '1088ml (13.6ml/kg)',
      limit: '800ml (10ml/kg)',
      overBy: '36%'
    }
  });

  // ISSUE 2: Race day water rates fall outside expected range
  issues.push({
    category: 'Race Day Water Per Hour',
    rootCause: `Algorithm uses 65% replacement for race day, but with modifiers:
    - High sweat rate base: 1200ml/h
    - With heat/sun/sport adjustments: can reach 1800-2000ml/h sweat
    - 65% of 2000ml = 1300ml/h (exceeds 1100ml/h general limit)
    - But validation expects race day to be 600-900ml/h for medium/high sweat
    
    Conversely, low sweat + cool conditions might give <600ml/h`,
    affectedScenarios: [
      'High sweat + hot + full sun + race day (running/triathlon)',
      'Low sweat + cool + race day (might be under 600ml/h)',
      'Extreme Ironman conditions'
    ],
    severity: 'CRITICAL',
    example: {
      scenario: 'Marathon, 70kg, high sweat, 32°C, full sun, race day',
      sweatRate: '1200ml/h × 1.60 (modifiers) = 1920ml/h',
      waterPerHour: '1920 × 0.65 = 1248ml/h',
      expectedRange: '600-900ml/h',
      overBy: '39%'
    }
  });

  // ISSUE 3: Swimming water intake too high
  issues.push({
    category: 'Swimming Over-Hydration',
    rootCause: `Swimming has -15% sport adjustment, but base sweat rates don't account for:
    - Water cooling effect (sweat rate should be 50-70% of running)
    - Practical intake difficulty while swimming
    - Pool vs open water differences
    
    Example: Medium sweat (900ml/h) with -15% = 765ml/h
    But realistic swimming intake should be 200-400ml/h max`,
    affectedScenarios: [
      'All swimming scenarios with medium/high sweat',
      'Long swim sessions (3h)',
      'Warm pool training'
    ],
    severity: 'HIGH',
    example: {
      scenario: 'Pool 1h, medium sweat, 25°C',
      calculated: '~700ml/h',
      realistic: '200-400ml/h',
      issue: 'Impractical to drink while swimming'
    }
  });

  // ISSUE 4: Sachet capping too conservative for ultra-endurance
  issues.push({
    category: 'Electrolyte Under-Dosing',
    rootCause: `Algorithm caps sachets at 2/hour max (line 128), but:
    - 12h Ironman in 35°C with high sweat + high saltiness
    - Sweat sodium: 1200mg/L × 1.5L/h × 12h = 21,600mg total loss
    - Current: 2 sachets/h × 12h = 12,000mg (only 55% replacement)
    
    The cap prevents adequate sodium replacement in extreme scenarios`,
    affectedScenarios: [
      'Ironman (9-13h) in hot conditions',
      'Ultra runs >8h with high salt loss',
      'Very high sweaters + high saltiness'
    ],
    severity: 'MEDIUM',
    example: {
      scenario: 'Ironman 11h, 70kg, high sweat, high salt, 33°C',
      sodiumLoss: '~20,000mg',
      sachetsNeeded: '40 sachets',
      actualCapped: '22 sachets (2/h × 11h)',
      deficit: '45%'
    }
  });

  // ISSUE 5: Short session pre-loading disproportionate
  issues.push({
    category: 'Short Session Pre-Hydration',
    rootCause: `For sessions <1h, pre-hydration formula doesn't scale down:
    - 10K run (0.5h): Still gets 480-640ml pre (based on weight)
    - Total sweat loss might only be 300-500ml
    - Pre-hydration alone could be 100-200% of entire session loss`,
    affectedScenarios: [
      '10K races (30-60min)',
      'Short pool swims (1h)',
      'Quick training sessions'
    ],
    severity: 'MEDIUM',
    example: {
      scenario: '10K, 60kg, 30min, medium sweat',
      totalSweatLoss: '450ml',
      preHydration: '600ml',
      ratio: '133% (pre alone exceeds total loss)'
    }
  });

  // ISSUE 6: Replacement rate calculation includes pre-hydration
  issues.push({
    category: 'Total Replacement Validation Logic',
    rootCause: `Validation calculates: (pre + during + post) / sweat_loss
    But pre-hydration is consumed hours before activity starts.
    
    A 4h session with aggressive pre-loading might show 150% replacement,
    flagging as excessive, when it's actually appropriate timing-wise.`,
    affectedScenarios: [
      'Long sessions with high pre-loading',
      'Race day scenarios with 2-4h pre-hydration',
      'Hot conditions requiring buffer'
    ],
    severity: 'MEDIUM',
    example: {
      scenario: 'Marathon 3.5h, race day, hot',
      sweatLoss: '3500ml',
      pre: '800ml',
      during: '2450ml (700ml/h × 3.5h)',
      post: '1500ml',
      total: '4750ml',
      replacementRate: '136%',
      validation: 'Flags as >100% but timing makes it appropriate'
    }
  });

  return issues;
}

export function summarizeIssues(issues: IssuePattern[]): string {
  const critical = issues.filter(i => i.severity === 'CRITICAL').length;
  const high = issues.filter(i => i.severity === 'HIGH').length;
  const medium = issues.filter(i => i.severity === 'MEDIUM').length;

  return `
🔍 ROOT CAUSE ANALYSIS COMPLETE

Found ${issues.length} systematic issues in the algorithm:
- ${critical} CRITICAL (breaks core logic)
- ${high} HIGH (produces dangerous recommendations)
- ${medium} MEDIUM (edge cases, UX issues)

CRITICAL ISSUES TO FIX FIRST:
${issues.filter(i => i.severity === 'CRITICAL').map(i => `- ${i.category}`).join('\n')}

HIGH PRIORITY:
${issues.filter(i => i.severity === 'HIGH').map(i => `- ${i.category}`).join('\n')}

MEDIUM PRIORITY:
${issues.filter(i => i.severity === 'MEDIUM').map(i => `- ${i.category}`).join('\n')}
`;
}
