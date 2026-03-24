import type { SachetMarker } from './planHelpers';

interface CourseDistanceBarProps {
  distanceKm: number;
  sachets: SachetMarker[];
}

export function CourseDistanceBar({ distanceKm, sachets }: CourseDistanceBarProps) {
  const quarterKm = Math.round(distanceKm * 0.25 * 10) / 10;
  const halfKm = Math.round(distanceKm * 0.5 * 10) / 10;
  const threeQuarterKm = Math.round(distanceKm * 0.75 * 10) / 10;

  const sachetPositions = sachets.map((s, i) => ({
    ...s,
    number: i + 1,
    pct: distanceKm > 0 ? Math.min((s.km / distanceKm) * 100, 100) : ((i + 1) / (sachets.length + 1)) * 100,
  }));

  return (
    <div className="space-y-2">
      {/* Sachet marker labels above the bar */}
      <div className="relative h-10">
        {sachetPositions.map(s => (
          <div
            key={s.number}
            className="absolute flex flex-col items-center"
            style={{ left: `${s.pct}%`, transform: 'translateX(-50%)' }}
          >
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-[#0a0a0a] rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap">
              #{s.number}
            </span>
            <div className="w-px h-2 bg-gray-500" />
          </div>
        ))}
      </div>

      {/* Bar */}
      <div className="relative h-2 bg-gray-700 rounded-full mx-2">
        {/* Distance dot markers at 0, 25, 50, 75, 100% */}
        {[0, 25, 50, 75, 100].map(pct => (
          <div
            key={pct}
            className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-gray-500 border-2 border-gray-800"
            style={{ left: `${pct}%`, transform: 'translate(-50%, -50%)' }}
          />
        ))}
        {/* Sachet markers on bar */}
        {sachetPositions.map(s => (
          <div
            key={s.number}
            className="absolute top-1/2 w-3 h-3 rounded-full bg-white border-2 border-white"
            style={{ left: `${s.pct}%`, transform: 'translate(-50%, -50%)' }}
          />
        ))}
      </div>

      {/* KM labels */}
      <div className="flex justify-between text-[10px] text-gray-500 px-1">
        <span>Start</span>
        <span>{quarterKm} km</span>
        <span>{halfKm} km</span>
        <span>{threeQuarterKm} km</span>
        <span>{distanceKm} km</span>
      </div>

      {/* Sachet detail list */}
      <div className="space-y-1 pt-1">
        {sachetPositions.map(s => (
          <div key={s.number} className="flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-[#0a0a0a] text-[10px] font-bold shrink-0">
              {s.number}
            </span>
            <span className="text-gray-400">
              Sachet #{s.number} at <span className="text-white font-medium">{s.timeStr}</span>
              {s.km > 0 && <> — km {s.km}</>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
