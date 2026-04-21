import type { HydrationPlan } from '@/types/hydration';

interface GelSummaryCardProps {
  plan: HydrationPlan;
}

export function GelSummaryCard({ plan }: GelSummaryCardProps) {
  const gel = plan.energyGel;

  if (!gel) return null;

  const isFootball = gel.sport === 'football';
  const intervalMin = gel.gelsPerHour > 0 ? Math.round(60 / gel.gelsPerHour) : 0;

  // Column definitions
  const col1 = {
    count: gel.phases.preMatch,
    label: isFootball ? 'Pre-Match' : 'Before',
    sub: gel.phases.preMatch > 0 ? '-15 min' : '—',
  };
  const col2 = {
    count: gel.phases.during,
    label: 'During',
    sub: gel.phases.during > 0 && intervalMin > 0
      ? `every ${intervalMin} min`
      : gel.phases.during > 0
      ? 'spread evenly'
      : gel.applicable ? 'None' : '—',
  };
  const col3 = {
    count: gel.phases.halftime,
    label: isFootball ? 'Half-Time' : 'Post-Race',
    sub: gel.phases.halftime > 0 ? 'at break' : '—',
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-gray-200 bg-gray-50">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          {gel.applicable
            ? `Energy Gel summary / ${gel.totalGels} total`
            : 'Energy Gel summary / not required'}
        </p>
      </div>

      {gel.applicable ? (
        <div className="grid grid-cols-3 gap-px bg-gray-200">
          {[col1, col2, col3].map(({ count, label, sub }) => (
            <div key={label} className="bg-white p-3 sm:p-4 text-center">
              <p className="text-2xl sm:text-3xl font-bold text-[#0a0a0a]">{count}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">{label}</p>
              <p className="text-[11px] text-gray-400">{sub}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white px-4 py-3 text-center">
          <p className="text-[13px] text-gray-400">{gel.timing}</p>
        </div>
      )}
    </div>
  );
}
