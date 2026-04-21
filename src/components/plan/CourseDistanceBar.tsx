import type { SachetMarker } from './planHelpers';

interface CourseDistanceBarProps {
  distanceKm: number;
  sachets: SachetMarker[];
  gels?: SachetMarker[];
}

export function CourseDistanceBar({ distanceKm, sachets, gels = [] }: CourseDistanceBarProps) {
  const quarterKm  = Math.round(distanceKm * 0.25 * 10) / 10;
  const halfKm     = Math.round(distanceKm * 0.5  * 10) / 10;
  const threeQ     = Math.round(distanceKm * 0.75 * 10) / 10;

  const sachetPos = sachets.map((s, i) => ({
    ...s,
    number: i + 1,
    pct: distanceKm > 0 ? Math.min((s.km / distanceKm) * 100, 100) : ((i + 1) / (sachets.length + 1)) * 100,
    type: 'sachet' as const,
  }));

  const gelPos = gels.map((g, i) => ({
    ...g,
    number: i + 1,
    pct: distanceKm > 0 ? Math.min((g.km / distanceKm) * 100, 100) : ((i + 1) / (gels.length + 1)) * 100,
    type: 'gel' as const,
  }));

  // Merge and sort chronologically for the list
  const allItems = [...sachetPos, ...gelPos].sort((a, b) => a.km - b.km);

  return (
    <div className="space-y-2 overflow-x-hidden">

      {/* Labels above bar */}
      <div className="relative h-10">
        {sachetPos.map(s => (
          <div
            key={`s-${s.number}`}
            className="absolute flex flex-col items-center"
            style={{ left: `${s.pct}%`, transform: 'translateX(-50%)' }}
          >
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-[#0a0a0a] rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap">
              S{s.number}
            </span>
            <div className="w-px h-2 bg-gray-500" />
          </div>
        ))}
        {gelPos.map(g => (
          <div
            key={`g-${g.number}`}
            className="absolute flex flex-col items-center"
            style={{ left: `${g.pct}%`, transform: 'translateX(-50%)' }}
          >
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e5ff00] text-[#0a0a0a] rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap">
              G{g.number}
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
        {/* Sachet markers — white */}
        {sachetPos.map(s => (
          <div
            key={`sm-${s.number}`}
            className="absolute top-1/2 w-3 h-3 rounded-full bg-white border-2 border-white"
            style={{ left: `${s.pct}%`, transform: 'translate(-50%, -50%)' }}
          />
        ))}
        {/* Gel markers — yellow */}
        {gelPos.map(g => (
          <div
            key={`gm-${g.number}`}
            className="absolute top-1/2 w-3 h-3 rounded-full border-2 border-[#e5ff00]"
            style={{ left: `${g.pct}%`, transform: 'translate(-50%, -50%)', background: '#e5ff00' }}
          />
        ))}
      </div>

      {/* KM labels */}
      <div className="flex justify-between text-[10px] text-gray-500 px-2">
        <span>Start</span>
        <span>{quarterKm} km</span>
        <span>{halfKm} km</span>
        <span>{threeQ} km</span>
        <span>{distanceKm} km</span>
      </div>

      {/* Legend */}
      {gels.length > 0 && (
        <div className="flex items-center gap-4 pt-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-white inline-block shrink-0" />
            <span className="text-[10px] text-gray-400">Electrolyte Sachet</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ background: '#e5ff00' }} />
            <span className="text-[10px] text-gray-400">Energy Gel</span>
          </div>
        </div>
      )}

      {/* Chronological detail list */}
      <div className="space-y-1 pt-1">
        {allItems.map((item, i) => {
          const isSachet = item.type === 'sachet';
          return (
            <div key={i} className="flex items-center gap-2 text-[11px]">
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0"
                style={isSachet
                  ? { background: '#fff', color: '#0a0a0a' }
                  : { background: '#e5ff00', color: '#0a0a0a' }}
              >
                {item.number}
              </span>
              <span className="text-gray-400">
                {isSachet ? 'Electrolyte Sachet' : 'Energy Gel'} #{item.number} at{' '}
                <span className="text-white font-medium">{item.timeStr}</span>
                {item.km > 0 && <> — km {item.km}</>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
