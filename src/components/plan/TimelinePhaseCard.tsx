import { ReactNode } from 'react';

interface TimelinePhaseCardProps {
  timeLabel: string;
  phaseName: string;
  isActive?: boolean;
  isLast?: boolean;
  children: ReactNode;
}

export function TimelinePhaseCard({ timeLabel, phaseName, isActive = false, isLast = false, children }: TimelinePhaseCardProps) {
  return (
    <div className="relative pl-8 sm:pl-10 pb-8">
      {/* Vertical line */}
      {!isLast && (
        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-gray-200" />
      )}
      {/* Dot */}
      <div className="absolute left-0 top-0 w-6 h-6 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center">
        {isActive && <div className="w-3 h-3 rounded-full bg-[#0a0a0a]" />}
      </div>
      {/* Content */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{timeLabel}</p>
        <p className="text-base font-bold text-[#0a0a0a]">{phaseName}</p>
        {children}
      </div>
    </div>
  );
}
