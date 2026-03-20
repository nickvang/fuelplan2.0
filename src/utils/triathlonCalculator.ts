import { HydrationProfile, TriathlonSegmentPlan } from '@/types/hydration';

// Transition time defaults (in hours)
export const T1_DURATION = 0.083; // 5 minutes swim→bike
export const T2_DURATION = 0.05;  // 3 minutes bike→run

// Standard triathlon distances (swim in m, bike in km, run in km)
export const TRIATHLON_DISTANCES = {
  'Sprint': { swim: 0.75, bike: 20, run: 5 },
  'Sprint Tri': { swim: 0.75, bike: 20, run: 5 },
  'Sprint Triathlon': { swim: 0.75, bike: 20, run: 5 },
  'Olympic': { swim: 1.5, bike: 40, run: 10 },
  'Olympic Tri': { swim: 1.5, bike: 40, run: 10 },
  'Olympic Triathlon': { swim: 1.5, bike: 40, run: 10 },
  'Half Ironman': { swim: 1.9, bike: 90, run: 21.1 },
  'Ironman 70.3': { swim: 1.9, bike: 90, run: 21.1 },
  '70.3': { swim: 1.9, bike: 90, run: 21.1 },
  'Ironman': { swim: 3.8, bike: 180, run: 42.2 },
  'Full Ironman': { swim: 3.8, bike: 180, run: 42.2 },
  '140.6': { swim: 3.8, bike: 180, run: 42.2 },
  // Custom: 2km swim, 100km bike, half-marathon run
  '2km/100km': { swim: 2, bike: 100, run: 21.1 },
};

/**
 * Parse swim pace from string format (e.g., "1:45/100m" or "1:45")
 * @returns swim pace in minutes per 100m
 */
function parseSwimPace(paceStr: string): number | null {
  if (!paceStr) return null;
  
  // Remove any /100m suffix
  const cleaned = paceStr.replace(/\/100m/i, '').trim();
  
  // Parse MM:SS format
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    if (!isNaN(minutes) && !isNaN(seconds)) {
      return minutes + seconds / 60;
    }
  }
  
  // If just a number (e.g., "1.5"), treat it as minutes (1:30)
  if (parts.length === 1) {
    const minutes = parseFloat(parts[0]);
    if (!isNaN(minutes)) {
      return minutes;
    }
  }
  
  return null;
}

/**
 * Parse bike speed from string format (e.g., "30 km/h" or "30")
 * @returns bike speed in km/h
 */
function parseBikeSpeed(speedStr: string): number | null {
  if (!speedStr) return null;
  
  // Extract number from string
  const match = speedStr.match(/(\d+\.?\d*)/);
  if (match) {
    const speed = parseFloat(match[1]);
    if (!isNaN(speed) && speed > 0) {
      return speed;
    }
  }
  
  return null;
}

/**
 * Parse run pace from string format (e.g., "5:30/km" or "5:30" or "5")
 * @returns run pace in minutes per km
 */
function parseRunPace(paceStr: string): number | null {
  if (!paceStr) return null;
  
  // Remove any /km suffix
  const cleaned = paceStr.replace(/\/km/i, '').trim();
  
  // Parse MM:SS format
  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    if (!isNaN(minutes) && !isNaN(seconds)) {
      return minutes + seconds / 60;
    }
  }
  
  // If just a number (e.g., "5"), treat it as minutes (5:00)
  if (parts.length === 1) {
    const minutes = parseFloat(parts[0]);
    if (!isNaN(minutes)) {
      return minutes;
    }
  }
  
  return null;
}

/**
 * Calculate total triathlon duration based on individual paces/speeds
 * @param profile - Hydration profile with triathlon-specific data
 * @returns total duration in hours, or null if calculation not possible
 */
export function calculateTriathlonDuration(profile: Partial<HydrationProfile>): number | null {
  const raceType = profile.raceDistance;
  if (!raceType) return null;
  
  // Get distances for this race type
  const distances = TRIATHLON_DISTANCES[raceType as keyof typeof TRIATHLON_DISTANCES];
  if (!distances) return null;
  
  // Parse individual paces/speeds
  const swimPace = parseSwimPace(profile.swimPace || '');
  const bikeSpeed = parseBikeSpeed(profile.bikeSpeed || profile.bikePower || '');
  const runPace = parseRunPace(profile.runPace || '');
  
  if (!swimPace || !bikeSpeed || !runPace) {
    return null; // Can't calculate without all three
  }
  
  // Calculate each segment duration in hours
  // Swim: (distance in km * 10) * pace per 100m / 60
  const swimDuration = (distances.swim * 10 * swimPace) / 60;
  
  // Bike: distance / speed
  const bikeDuration = distances.bike / bikeSpeed;
  
  // Run: distance * pace per km / 60
  const runDuration = (distances.run * runPace) / 60;
  
  // Total duration including transitions
  const totalDuration = swimDuration + T1_DURATION + bikeDuration + T2_DURATION + runDuration;

  if (import.meta.env.DEV) {
    console.log('🏊‍♂️🚴‍♂️🏃‍♂️ Triathlon Duration Calculation:', {
      raceType,
      distances,
      swimPace: `${swimPace.toFixed(2)} min/100m`,
      bikeSpeed: `${bikeSpeed.toFixed(1)} km/h`,
      runPace: `${runPace.toFixed(2)} min/km`,
      swimDuration: `${(swimDuration * 60).toFixed(1)} min`,
      t1: `${(T1_DURATION * 60).toFixed(0)} min`,
      bikeDuration: `${(bikeDuration * 60).toFixed(1)} min`,
      t2: `${(T2_DURATION * 60).toFixed(0)} min`,
      runDuration: `${(runDuration * 60).toFixed(1)} min`,
      totalDuration: `${totalDuration.toFixed(2)} hours`
    });
  }

  return totalDuration;
}

/**
 * Get triathlon breakdown for display
 */
export function getTriathlonBreakdown(profile: Partial<HydrationProfile>) {
  const raceType = profile.raceDistance;
  if (!raceType) return null;
  
  const distances = TRIATHLON_DISTANCES[raceType as keyof typeof TRIATHLON_DISTANCES];
  if (!distances) return null;
  
  const swimPace = parseSwimPace(profile.swimPace || '');
  const bikeSpeed = parseBikeSpeed(profile.bikeSpeed || profile.bikePower || '');
  const runPace = parseRunPace(profile.runPace || '');
  
  if (!swimPace || !bikeSpeed || !runPace) return null;
  
  const swimDuration = (distances.swim * 10 * swimPace) / 60;
  const bikeDuration = distances.bike / bikeSpeed;
  const runDuration = (distances.run * runPace) / 60;
  
  return {
    swim: {
      distance: distances.swim,
      pace: swimPace,
      duration: swimDuration
    },
    t1: {
      duration: T1_DURATION
    },
    bike: {
      distance: distances.bike,
      speed: bikeSpeed,
      duration: bikeDuration
    },
    t2: {
      duration: T2_DURATION
    },
    run: {
      distance: distances.run,
      pace: runPace,
      duration: runDuration
    },
    total: swimDuration + T1_DURATION + bikeDuration + T2_DURATION + runDuration
  };
}

/**
 * Get segment-aware hydration plan for triathlon
 * @param profile - Hydration profile
 * @param sachetsPerHour - Base sachets per hour from hydration calculator
 * @param waterPerHourBike - Water per hour for cycling (full rate)
 * @param waterPerHourRun - Water per hour for running (reduced rate)
 */
export function getTriathlonSegmentPlan(
  profile: Partial<HydrationProfile>,
  sachetsPerHour: number,
  waterPerHourBike: number,
  waterPerHourRun: number
): TriathlonSegmentPlan | null {
  const breakdown = getTriathlonBreakdown(profile);
  if (!breakdown) return null;

  // Swim: no hydration possible
  const swim = {
    duration: breakdown.swim.duration,
    distance: breakdown.swim.distance,
    sachets: 0,
    fluid: 0,
  };

  // T1: critical intake window — 1 sachet + 200ml
  const t1 = {
    duration: T1_DURATION,
    sachets: 1,
    fluid: 200,
  };

  // Bike: full hydration rate (best intake opportunity)
  const bikeSachets = Math.round(sachetsPerHour * breakdown.bike.duration);
  const bikeFluid = Math.round(waterPerHourBike * breakdown.bike.duration);
  const bike = {
    duration: breakdown.bike.duration,
    distance: breakdown.bike.distance,
    sachets: bikeSachets,
    fluid: bikeFluid,
  };

  // T2: no sachet, but 100ml fluid
  const t2 = {
    duration: T2_DURATION,
    sachets: 0,
    fluid: 100,
  };

  // Run: reduced hydration rate
  const runSachets = Math.max(0, Math.round(sachetsPerHour * breakdown.run.duration) - 0); // keep same rate, rely on caps
  const runFluid = Math.round(waterPerHourRun * breakdown.run.duration);
  const run = {
    duration: breakdown.run.duration,
    distance: breakdown.run.distance,
    sachets: runSachets,
    fluid: runFluid,
  };

  const totalSachets = swim.sachets + t1.sachets + bike.sachets + t2.sachets + run.sachets;
  const totalFluid = swim.fluid + t1.fluid + bike.fluid + t2.fluid + run.fluid;

  return {
    swim,
    t1,
    bike,
    t2,
    run,
    totalDuration: breakdown.total,
    totalSachets,
    totalFluid,
  };
}
