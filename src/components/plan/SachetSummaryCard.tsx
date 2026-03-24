import type { HydrationPlan } from '@/types/hydration';
import { computeTotalSachets } from './planHelpers';

interface SachetSummaryCardProps {
  plan: HydrationPlan;
  distanceKm: number;
  sessionDuration: number;
}

export function SachetSummaryCard({ plan, distanceKm, sessionDuration }: SachetSummaryCardProps) {
  const total = computeTotalSachets(plan);
  const halfwayKm = Math.round(distanceKm / 2 * 10) / 10;
  const duringCount = plan.duringActivity.totalElectrolytes;
  const showDuringLocation = sessionDuration >= 2 && duringCount > 0;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-gray-200 bg-gray-50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Sachet summary / {total} total
        </p>
      </div>
      <div className="grid grid-cols-3 gap-px bg-gray-200">
        <div className="bg-white p-3.5 text-center">
          <p className="text-2xl font-bold text-[#0a0a0a]">{plan.preActivity.electrolytes}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">Pre-race</p>
          <p className="text-[11px] text-gray-400">T-2 h</p>
        </div>
        <div className="bg-white p-3.5 text-center">
          <p className="text-2xl font-bold text-[#0a0a0a]">{duringCount}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">During</p>
          <p className="text-[11px] text-gray-400">
            {showDuringLocation ? `at ${halfwayKm} km` : duringCount === 0 ? 'None' : 'Spread evenly'}
          </p>
        </div>
        <div className="bg-white p-3.5 text-center">
          <p className="text-2xl font-bold text-[#0a0a0a]">{plan.postActivity.electrolytes}</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">Post-race</p>
          <p className="text-[11px] text-gray-400">at finish</p>
        </div>
      </div>
    </div>
  );
}
