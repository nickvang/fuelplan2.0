import type { HydrationPlan, HydrationProfile } from '@/types/hydration';
import { computeTotalSachets } from './planHelpers';

interface SupplmeSummaryCardProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
  distanceKm: number;
  sessionDuration: number;
  stageRaceTotals?: { pre: number; during: number; post: number; stages: number };
}

export function SupplmeSummaryCard({
  plan,
  distanceKm,
  sessionDuration,
  stageRaceTotals,
}: SupplmeSummaryCardProps) {
  const isStageRace = !!stageRaceTotals;
  const totalSachets = isStageRace
    ? stageRaceTotals.pre + stageRaceTotals.during + stageRaceTotals.post
    : computeTotalSachets(plan);
  const halfwayKm = Math.round((distanceKm / 2) * 10) / 10;
  const duringCount = isStageRace ? stageRaceTotals.during : plan.duringActivity.totalElectrolytes;
  const preCount = isStageRace ? stageRaceTotals.pre : plan.preActivity.electrolytes;
  const postCount = isStageRace ? stageRaceTotals.post : plan.postActivity.electrolytes;
  const showDuringLocation = !isStageRace && sessionDuration >= 2 && duringCount > 0;

  const gel = plan.energyGel;
  const intervalMin = gel && gel.gelsPerHour > 0 ? Math.round(60 / gel.gelsPerHour) : 0;
  const isFootball = gel?.sport === 'football';

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* ── Electrolyte section ── */}
      <div className="px-3.5 py-2.5 border-b border-gray-200 bg-gray-50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {isStageRace
            ? `Hydration sachet summary / ${totalSachets} total across ${stageRaceTotals.stages} stage${stageRaceTotals.stages !== 1 ? 's' : ''}`
            : `Hydration sachet summary / ${totalSachets} total`}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-px bg-gray-200">
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-2xl font-bold text-[#0a0a0a]">{preCount}</p>
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">Pre-race</p>
        </div>
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-2xl font-bold text-[#0a0a0a]">{duringCount}</p>
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">During</p>
        </div>
        <div className="bg-white p-2.5 sm:p-3.5 text-center">
          <p className="text-2xl font-bold text-[#0a0a0a]">{postCount}</p>
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">Post-race</p>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="h-px bg-gray-200" />

      {/* ── Energy Gel section ── */}
      {gel ? (
        <>
          <div className="px-3.5 py-2.5 border-b border-gray-200 bg-gray-50">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              {gel.applicable
                ? `Energy gel summary / ${gel.totalGels} total`
                : 'Energy gel summary / not required'}
            </p>
          </div>
          {gel.applicable ? (
            <div className="grid grid-cols-3 gap-px bg-gray-200">
              {[
                {
                  count: gel.phases.preMatch,
                  label: isFootball ? 'Pre-Match' : 'Before',
                  sub: gel.phases.preMatch > 0 ? '-15 min' : '—',
                },
                {
                  count: gel.phases.during,
                  label: 'During',
                  sub:
                    gel.phases.during > 0 && intervalMin > 0
                      ? `every ${intervalMin} min`
                      : gel.phases.during > 0
                      ? 'spread evenly'
                      : '—',
                },
                {
                  count: gel.phases.halftime,
                  label: isFootball ? 'Half-Time' : 'Post-Race',
                  sub: gel.phases.halftime > 0 ? 'at break' : '—',
                },
              ].map(({ count, label }) => (
                <div key={label} className="bg-white p-2.5 sm:p-3.5 text-center">
                  <p className="text-2xl font-bold text-[#0a0a0a]">{count}</p>
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white px-4 py-3 text-center">
              <p className="text-[13px] text-gray-400">{gel.timing}</p>
            </div>
          )}
        </>
      ) : null}

    </div>
  );
}
