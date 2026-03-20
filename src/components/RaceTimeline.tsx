import { HydrationPlan, HydrationProfile, SUPPLME_ELECTROLYTE_SPEC } from '@/types/hydration';

interface RaceTimelineProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
}

const safeNumber = (value: number | null | undefined, fallback: number = 0): number => {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) return fallback;
  return value;
};

export function RaceTimeline({ plan, profile }: RaceTimelineProps) {
  const isSwimOnly = profile.disciplines?.includes('Swimming') && !profile.disciplines?.includes('Triathlon');

  const stages = [
    {
      key: 'pre',
      label: 'PRE',
      time: '-2h',
      icon: '🌅',
      color: 'bg-blue-500',
      dotColor: 'border-blue-500',
      sachets: plan.preActivity.electrolytes,
      fluid: plan.preActivity.water,
      note: plan.preActivity.timing,
    },
    {
      key: 'start',
      label: 'START',
      time: '0:00',
      icon: '🏁',
      color: 'bg-primary',
      dotColor: 'border-primary',
      sachets: 0,
      fluid: 0,
      note: 'Small sips only',
    },
    ...(!isSwimOnly ? [{
      key: 'during',
      label: 'DURING',
      time: plan.duringActivity.frequency,
      icon: '⚡',
      color: 'bg-amber-500',
      dotColor: 'border-amber-500',
      sachets: plan.duringActivity.totalElectrolytes,
      fluid: Math.round(safeNumber(plan.duringActivity.waterPerHour) * profile.sessionDuration),
      note: `${safeNumber(plan.duringActivity.waterPerHour)}ml/h`,
    }] : []),
    {
      key: 'finish',
      label: 'FINISH',
      time: formatDuration(profile.sessionDuration),
      icon: '🏆',
      color: 'bg-green-500',
      dotColor: 'border-green-500',
      sachets: 0,
      fluid: 0,
      note: 'Immediate rehydration',
    },
    {
      key: 'recovery',
      label: 'RECOVERY',
      time: '+4-6h',
      icon: '🔄',
      color: 'bg-purple-500',
      dotColor: 'border-purple-500',
      sachets: plan.postActivity.electrolytes,
      fluid: plan.postActivity.water,
      note: plan.postActivity.timing,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">📋</span>
        <h3 className="text-base font-bold uppercase tracking-wide text-foreground">
          Race Timeline
        </h3>
      </div>

      {/* Horizontal timeline for desktop */}
      <div className="hidden sm:block">
        {/* Connecting line */}
        <div className="relative mx-8">
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-border" />
          <div className="flex justify-between relative">
            {stages.map((stage) => (
              <div key={stage.key} className="flex flex-col items-center text-center w-24">
                {/* Dot */}
                <div className={`w-10 h-10 rounded-full ${stage.color} flex items-center justify-center text-white text-lg shadow-lg z-10`}>
                  {stage.icon}
                </div>
                {/* Label */}
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">
                  {stage.label}
                </p>
                <p className="text-xs font-mono font-bold text-foreground">{stage.time}</p>
                {/* Sachet/fluid info */}
                {(stage.sachets > 0 || stage.fluid > 0) && (
                  <div className="mt-1 space-y-0.5">
                    {stage.sachets > 0 && (
                      <p className="text-[10px] font-bold text-primary">
                        {stage.sachets} sachet{stage.sachets !== 1 ? 's' : ''}
                      </p>
                    )}
                    {stage.fluid > 0 && (
                      <p className="text-[10px] text-muted-foreground">{stage.fluid}ml</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vertical timeline for mobile */}
      <div className="sm:hidden space-y-0">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex gap-3">
            {/* Dot + line */}
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full ${stage.color} flex items-center justify-center text-white text-sm shadow-md shrink-0`}>
                {stage.icon}
              </div>
              {i < stages.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
            </div>
            {/* Content */}
            <div className="pb-4 min-w-0">
              <div className="flex items-baseline gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">{stage.label}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{stage.time}</p>
              </div>
              {(stage.sachets > 0 || stage.fluid > 0) && (
                <div className="flex gap-3 mt-0.5">
                  {stage.sachets > 0 && (
                    <span className="text-xs font-bold text-primary">
                      {stage.sachets} sachet{stage.sachets !== 1 ? 's' : ''}
                    </span>
                  )}
                  {stage.fluid > 0 && (
                    <span className="text-xs text-muted-foreground">{stage.fluid}ml</span>
                  )}
                </div>
              )}
              {stage.note && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{stage.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}
