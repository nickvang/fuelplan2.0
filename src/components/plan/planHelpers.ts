import type { HydrationPlan, HydrationProfile } from '@/types/hydration';

export const safeNumber = (value: number | null | undefined, fallback: number = 0): number => {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return fallback;
  }
  return value;
};

export const formatHoursAsTime = (hours: number): string => {
  const h = Math.floor(hours);
  const remainingMinutes = (hours - h) * 60;
  const m = Math.floor(remainingMinutes);
  const s = Math.round((remainingMinutes - m) * 60);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const formatSegmentDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

export const formatDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export const parseDistanceKm = (raceDistance: string | undefined): number => {
  if (!raceDistance) return 5;
  const raceText = raceDistance.toLowerCase();

  const raceDistances: Record<string, number> = {
    'half ironman': 113,
    'ironman 70.3': 113,
    '70.3': 113,
    'ironman': 226,
    'full ironman': 226,
    '140.6': 226,
    'olympic': 51.5,
    'sprint': 25.75,
    'half marathon': 21.1,
    'marathon': 42.2,
    'ultra': 50,
    '50k': 50,
    '100k': 100,
    '100 mile': 160,
    '10k': 10,
    '5k': 5,
    'century': 160,
    '100 miles': 160,
  };

  for (const [name, dist] of Object.entries(raceDistances)) {
    if (raceText.includes(name)) return dist;
  }

  const match = raceDistance.match(/(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 5;
};

export const buildActivityLabel = (
  profile: HydrationProfile,
  selectedRace?: { name: string } | null,
): string => {
  const parts: string[] = [];
  if (profile.disciplines?.[0]) parts.push(profile.disciplines[0]);
  if (profile.raceDistance) parts.push(profile.raceDistance);
  if (profile.terrain) parts.push(profile.terrain);
  return parts.join(' / ') || 'Activity';
};

export const computeTotalSachets = (plan: HydrationPlan): number =>
  plan.preActivity.electrolytes +
  plan.duringActivity.totalElectrolytes +
  plan.postActivity.electrolytes;

export interface SachetMarker {
  km: number;
  timeStr: string;
}

export const computeDuringSachetSchedule = (
  plan: HydrationPlan,
  profile: HydrationProfile,
  distanceKm: number,
): SachetMarker[] => {
  const total = plan.duringActivity.totalElectrolytes;
  if (total <= 0) return [];

  const totalMin = Math.round(profile.sessionDuration * 60);
  const isRace = profile.raceDistance && profile.raceDistance.length > 0;
  const startOffset = isRace ? Math.round(totalMin * 0.2) : 15;
  const endCutoff = Math.max(0, totalMin - 20);
  const usableWindow = Math.max(1, endCutoff - startOffset);
  const minGap = 20;
  const rawInterval = total > 1 ? Math.round(usableWindow / (total - 1)) : usableWindow;
  const interval = Math.max(rawInterval, minGap);
  const pacePerKm = distanceKm > 0 ? totalMin / distanceKm : 0;

  return Array.from({ length: total }, (_, i) => {
    const minuteMark = Math.min(startOffset + Math.round(interval * i), endCutoff);
    const km = pacePerKm > 0 ? Math.round((minuteMark / pacePerKm) * 10) / 10 : 0;
    const h = Math.floor(minuteMark / 60);
    const m = minuteMark % 60;
    const timeStr = h > 0 ? `${h}h ${m}min` : `${m} min`;
    return { km, timeStr };
  });
};
