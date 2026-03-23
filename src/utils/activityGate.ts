/**
 * Activity-specific common-sense gates for sachet consumption.
 * Returns maximum sachet counts that should only REDUCE the calculator output, never increase it.
 */

export interface ActivityGateResult {
  duringMax: number;
  preOverride?: number;
  postMax: number;
  notes: string[];
  warnings: string[];
}

export function activityCommonSenseGate(
  discipline: string,
  durationHours: number,
  isRaceDay: boolean,
  raceDistance?: string,
  crampTiming?: string
): ActivityGateResult {
  const notes: string[] = [];
  const warnings: string[] = [];
  let duringMax = 99; // default: no gate
  let postMax = 3;
  let preOverride: number | undefined;

  const hasCramping = crampTiming && crampTiming !== 'none';

  switch (discipline) {
    case 'Swimming': {
      if (isRaceDay) {
        duringMax = 0;
        postMax = 2;
        notes.push('Swimming race: 0 sachets during (impossible to consume in water)');
      } else if (durationHours < 2) {
        duringMax = 0;
        notes.push('Swimming training <2h: 0 during-sachets');
      } else {
        // Training 2h+: limited at wall rests
        duringMax = Math.min(2, Math.floor(durationHours / 1.5));
        notes.push(`Swimming training ${durationHours}h: max ${duringMax} sachets at wall rests`);
      }
      break;
    }

    case 'Gym':
    case 'CrossFit':
    case 'HIIT':
    case 'Weight training': {
      if (durationHours < 0.75) {
        duringMax = 0;
        postMax = 1;
        notes.push(`${discipline} <45min: 0 during-sachets`);
      } else if (durationHours < 1.5) {
        duringMax = 1;
        notes.push(`${discipline} 45-90min: max 1 during-sachet`);
      } else {
        duringMax = 2;
        notes.push(`${discipline} 90min+: max 2 during-sachets`);
      }
      break;
    }

    case 'Walking':
    case 'Hiking': {
      if (durationHours < 1) {
        duringMax = 0;
        postMax = 1;
        notes.push(`${discipline} <1h: 0 during-sachets`);
      } else if (durationHours < 2) {
        duringMax = 1;
        notes.push(`${discipline} 1-2h: max 1 during-sachet`);
      } else {
        duringMax = Math.min(4, Math.floor(durationHours / 1.5));
        notes.push(`${discipline} ${durationHours}h: max ${duringMax} during-sachets`);
      }
      break;
    }

    case 'Running': {
      const dist = raceDistance?.toLowerCase() || '';
      const is5K = dist.includes('5k') || dist.includes('5 km');
      const is10K = dist.includes('10k') || dist.includes('10 km');

      if (isRaceDay && (is5K || is10K)) {
        // Short race: pre only, 0 during, 1 post
        duringMax = 0;
        postMax = 1;
        preOverride = 1;
        notes.push(`Running ${is5K ? '5K' : '10K'} race: pre-load only, 0 during`);
      } else if (durationHours < 1) {
        duringMax = 0;
        notes.push('Running <1h: 0 during-sachets');
      } else if (durationHours < 2) {
        duringMax = hasCramping ? 1 : 0;
        if (hasCramping) {
          notes.push('Running 1-2h with cramping history: 1 during-sachet allowed');
        } else {
          notes.push('Running 1-2h: 0 during-sachets (pre+post covers it)');
        }
      } else {
        // Duration-based: ~1 per hour of consumable time
        const consumable = Math.max(0, durationHours - 0.5);
        duringMax = Math.min(5, Math.ceil(consumable));
        if (hasCramping) {
          duringMax = Math.min(5, duringMax + 1);
          notes.push(`Running ${durationHours}h with cramping: max ${duringMax} during-sachets`);
        } else {
          notes.push(`Running ${durationHours}h: max ${duringMax} during-sachets`);
        }
      }
      break;
    }

    case 'Cycling': {
      if (durationHours < 1) {
        duringMax = 0;
        notes.push('Cycling <1h: 0 during-sachets');
      } else if (durationHours < 2) {
        duringMax = 1;
        notes.push('Cycling 1-2h: max 1 during-sachet');
      } else {
        // Cycling is more generous due to bottle access
        const consumable = Math.max(0, durationHours - 0.5);
        duringMax = Math.min(5, Math.ceil(consumable * 1.2));
        notes.push(`Cycling ${durationHours}h: max ${duringMax} during-sachets`);
      }
      break;
    }

    case 'Triathlon': {
      const dist = raceDistance?.toLowerCase() || '';
      if (dist.includes('sprint')) {
        duringMax = 1;
        postMax = 1;
        notes.push('Sprint triathlon: max 1 during-sachet (T1 only)');
      } else if (dist.includes('olympic')) {
        duringMax = 2;
        postMax = 1;
        notes.push('Olympic triathlon: max 2 during-sachets');
      } else if (dist.includes('70.3') || dist.includes('half ironman')) {
        duringMax = 4;
        postMax = 2;
        notes.push('70.3 triathlon: max 4 during-sachets');
      } else if (dist.includes('ironman') || dist.includes('140.6') || dist.includes('full')) {
        duringMax = 5;
        postMax = 2;
        notes.push('Ironman triathlon: max 5 during-sachets');
      } else {
        // Unknown triathlon distance: duration-based
        duringMax = Math.min(5, Math.ceil(durationHours * 0.6));
        notes.push(`Triathlon ${durationHours}h: max ${duringMax} during-sachets`);
      }
      break;
    }

    default: {
      // Generic: duration-based
      if (durationHours < 1) {
        duringMax = 0;
      } else if (durationHours < 2) {
        duringMax = 1;
      } else {
        duringMax = Math.min(5, Math.ceil(durationHours * 0.8));
      }
      notes.push(`${discipline} ${durationHours}h: max ${duringMax} during-sachets`);
      break;
    }
  }

  // Absolute ceiling from SACHET_SAFETY
  if (duringMax > 5) {
    duringMax = 5;
    warnings.push('During-sachet gate capped at 5 (absolute event max is 6 incl. pre)');
  }

  return { duringMax, preOverride, postMax, notes, warnings };
}
