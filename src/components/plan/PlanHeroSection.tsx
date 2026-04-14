import type { HydrationPlan, HydrationProfile } from '@/types/hydration';
import { buildActivityLabel, computeTotalSachets, formatHoursAsTime, safeNumber } from './planHelpers';

interface PlanHeroSectionProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
  distanceKm: number;
  hasStrava: boolean;
  selectedRace?: { name: string } | null;
}

export function PlanHeroSection({ plan, profile, distanceKm, hasStrava, selectedRace }: PlanHeroSectionProps) {
  const activityLabel = buildActivityLabel(profile, selectedRace);
  const totalSachets = computeTotalSachets(plan);

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {activityLabel}
      </p>
      <h1 className="text-[26px] font-bold leading-tight text-[#0a0a0a]">
        Your Race Day Hydration Plan
      </h1>

      {/* 4-stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-200 border border-gray-200 rounded-lg overflow-hidden">
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Distance</p>
          <p className="text-xl font-bold text-[#0a0a0a]">{distanceKm}</p>
          <p className="text-[11px] text-gray-400">km</p>
        </div>
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Target time</p>
          <p className="text-xl font-bold text-[#0a0a0a]">{formatHoursAsTime(profile.sessionDuration)}</p>
        </div>
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Est. fluid loss</p>
          <p className="text-xl font-bold text-[#0a0a0a]">{(safeNumber(plan.totalFluidLoss) / 1000).toFixed(1)}</p>
          <p className="text-[11px] text-gray-400">litres</p>
        </div>
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Sachets total</p>
          <p className="text-xl font-bold text-[#0a0a0a]">{totalSachets}</p>
        </div>
      </div>

      {/* Strava badge */}
      {hasStrava && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z" fill="#FC4C02" />
            <path d="M7.778 13.828h3.065L5.613 0 0 13.828h3.065l2.548-4.765 2.165 4.765z" fill="#FC4C02" />
          </svg>
          <span className="text-[11px] font-bold tracking-wide text-orange-700">Enhanced with Strava</span>
        </div>
      )}
    </div>
  );
}
