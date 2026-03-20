import { TriathlonSegmentPlan } from '@/types/hydration';
import { Card } from '@/components/ui/card';

interface TriathlonSegmentDisplayProps {
  segments: TriathlonSegmentPlan;
}

const formatMinutes = (hours: number): string => {
  const totalMin = Math.round(hours * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
};

export function TriathlonSegmentDisplay({ segments }: TriathlonSegmentDisplayProps) {
  const segmentData = [
    {
      key: 'swim',
      label: 'Swim',
      icon: '🏊',
      color: 'bg-blue-500',
      bgColor: 'bg-blue-500/10 border-blue-500/30',
      duration: segments.swim.duration,
      distance: `${segments.swim.distance} km`,
      sachets: segments.swim.sachets,
      fluid: segments.swim.fluid,
    },
    {
      key: 't1',
      label: 'T1',
      icon: '🔄',
      color: 'bg-muted-foreground',
      bgColor: 'bg-muted/60 border-border',
      duration: segments.t1.duration,
      distance: null,
      sachets: segments.t1.sachets,
      fluid: segments.t1.fluid,
    },
    {
      key: 'bike',
      label: 'Bike',
      icon: '🚴',
      color: 'bg-purple-500',
      bgColor: 'bg-purple-500/10 border-purple-500/30',
      duration: segments.bike.duration,
      distance: `${segments.bike.distance} km`,
      sachets: segments.bike.sachets,
      fluid: segments.bike.fluid,
    },
    {
      key: 't2',
      label: 'T2',
      icon: '🔄',
      color: 'bg-muted-foreground',
      bgColor: 'bg-muted/60 border-border',
      duration: segments.t2.duration,
      distance: null,
      sachets: segments.t2.sachets,
      fluid: segments.t2.fluid,
    },
    {
      key: 'run',
      label: 'Run',
      icon: '🏃',
      color: 'bg-orange-500',
      bgColor: 'bg-orange-500/10 border-orange-500/30',
      duration: segments.run.duration,
      distance: `${segments.run.distance} km`,
      sachets: segments.run.sachets,
      fluid: segments.run.fluid,
    },
  ];

  // Calculate relative widths for the timeline bar
  const totalDuration = segments.totalDuration;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🏅</span>
        <h3 className="text-base font-bold uppercase tracking-wide text-foreground">
          Triathlon Segment Breakdown
        </h3>
      </div>

      {/* Timeline bar showing relative proportions */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {segmentData.map((seg) => (
          <div
            key={seg.key}
            className={`${seg.color} transition-all duration-500`}
            style={{ width: `${(seg.duration / totalDuration) * 100}%`, minWidth: seg.key.startsWith('t') ? '3%' : undefined }}
            title={`${seg.label}: ${formatMinutes(seg.duration)}`}
          />
        ))}
      </div>

      {/* Segment cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {segmentData.map((seg) => (
          <Card
            key={seg.key}
            className={`p-2 sm:p-3 border ${seg.bgColor} text-center`}
          >
            <span className="text-lg sm:text-xl block mb-1">{seg.icon}</span>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wide text-foreground">
              {seg.label}
            </p>
            <p className="text-xs sm:text-sm font-black metric-number text-foreground mt-1">
              {formatMinutes(seg.duration)}
            </p>
            {seg.distance && (
              <p className="text-[10px] sm:text-xs text-muted-foreground">{seg.distance}</p>
            )}
            <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
              <p className="text-[10px] sm:text-xs font-semibold text-foreground">
                {seg.sachets > 0 ? `${seg.sachets} sachet${seg.sachets !== 1 ? 's' : ''}` : '—'}
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {seg.fluid > 0 ? `${seg.fluid}ml` : 'No fluid'}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Totals row */}
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border/60 text-xs">
        <span className="font-semibold text-muted-foreground uppercase tracking-wide">Totals</span>
        <div className="flex gap-4">
          <span className="font-bold text-foreground">{formatMinutes(segments.totalDuration)}</span>
          <span className="font-bold text-foreground">{segments.totalSachets} sachets</span>
          <span className="font-bold text-foreground">{segments.totalFluid}ml</span>
        </div>
      </div>
    </div>
  );
}
