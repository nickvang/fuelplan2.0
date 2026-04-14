import type { HydrationPlan } from '@/types/hydration';
import { computeTotalSachets } from './planHelpers';

interface SachetSummaryCardProps {
  plan: HydrationPlan;
  distanceKm: number;
  sessionDuration: number;
  stageRaceTotals?: { pre: number; during: number; post: number; stages: number };
}

export function SachetSummaryCard({ plan, distanceKm, sessionDuration, stageRaceTotals }: SachetSummaryCardProps) {
  const isStageRace = !!stageRaceTotals;
  const total = isStageRace
    ? stageRaceTotals.pre + stageRaceTotals.during + stageRaceTotals.post
    : computeTotalSachets(plan);
  const halfwayKm = Math.round(distanceKm / 2 * 10) / 10;
  const duringCount = isStageRace ? stageRaceTotals.during : plan.duringActivity.totalElectrolytes;
  const preCount = isStageRace ? stageRaceTotals.pre : plan.preActivity.electrolytes;
  const postCount = isStageRace ? stageRaceTotals.post : plan.postActivity.electrolytes;
  const showDuringLocation = !isStageRace && sessionDuration >= 2 && duringCount > 0;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-gray-200 bg-gray-50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {isStageRace
            ? `Sachet summary / ${total} total across ${stageRaceTotals.stages} stage${stageRaceTotals.stages !== 1 ? 's' : ''}`
            : `Sachet summary / ${total} total`}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-px bg-gray-200">
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-2xl font-bold text-[#0a0a0a]">{preCount}</p>
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">Pre-race</p>
          <p className="text-[10px] sm:text-[11px] text-gray-400">{isStageRace ? `${plan.preActivity.electrolytes}/stage` : 'T-2 h'}</p>
        </div>
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-2xl font-bold text-[#0a0a0a]">{duringCount}</p>
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">During</p>
          <p className="text-[10px] sm:text-[11px] text-gray-400">
            {isStageRace ? 'all stages' : showDuringLocation ? `at ${halfwayKm} km` : duringCount === 0 ? 'None' : 'Spread evenly'}
          </p>
        </div>
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-2xl font-bold text-[#0a0a0a]">{postCount}</p>
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">Post-race</p>
          <p className="text-[10px] sm:text-[11px] text-gray-400">{isStageRace ? `${plan.postActivity.electrolytes}/stage` : 'at finish'}</p>
        </div>
      </div>
    </div>
  );
}
