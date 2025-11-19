import { HydrationProfile } from '@/types/hydration';

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
 * Parse run pace from string format (e.g., "5:30/km" or "5:30")
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
  
  // Total duration (not including transitions for now)
  const totalDuration = swimDuration + bikeDuration + runDuration;
  
  console.log('🏊‍♂️🚴‍♂️🏃‍♂️ Triathlon Duration Calculation:', {
    raceType,
    distances,
    swimPace: `${swimPace.toFixed(2)} min/100m`,
    bikeSpeed: `${bikeSpeed.toFixed(1)} km/h`,
    runPace: `${runPace.toFixed(2)} min/km`,
    swimDuration: `${(swimDuration * 60).toFixed(1)} min`,
    bikeDuration: `${(bikeDuration * 60).toFixed(1)} min`,
    runDuration: `${(runDuration * 60).toFixed(1)} min`,
    totalDuration: `${totalDuration.toFixed(2)} hours`
  });
  
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
    bike: {
      distance: distances.bike,
      speed: bikeSpeed,
      duration: bikeDuration
    },
    run: {
      distance: distances.run,
      pace: runPace,
      duration: runDuration
    },
    total: swimDuration + bikeDuration + runDuration
  };
}
