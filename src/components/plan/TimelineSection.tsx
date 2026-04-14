import type { HydrationPlan, HydrationProfile } from '@/types/hydration';
import { TimelinePhaseCard } from './TimelinePhaseCard';
import { CourseDistanceBar } from './CourseDistanceBar';
import { safeNumber, computeDuringSachetSchedule, formatSegmentDuration } from './planHelpers';

interface TimelineSectionProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
  distanceKm: number;
  isSwimming: boolean;
  isTriathlon: boolean;
}

const PillBadge = ({ children, inverted = false }: { children: React.ReactNode; inverted?: boolean }) => (
  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
    inverted ? 'bg-white text-[#0a0a0a]' : 'bg-[#0a0a0a] text-white'
  }`}>
    {children}
  </span>
);

export function TimelineSection({ plan, profile, distanceKm, isSwimming, isTriathlon }: TimelineSectionProps) {
  const sachetSchedule = computeDuringSachetSchedule(plan, profile, distanceKm);
  const showCourseBar = distanceKm >= 5 && !isSwimming && !isTriathlon && sachetSchedule.length > 0;

  return (
    <div className="space-y-4">
      <div>
        {/* Phase 1: Day Before */}
        <TimelinePhaseCard timeLabel="T-24 hours" phaseName="Day Before">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-100">
              <div className="flex justify-between items-center gap-2 px-3 sm:px-3.5 py-3">
                <span className="text-[13px] text-gray-600 min-w-0 shrink">Water throughout the day</span>
                <span className="text-[13px] font-semibold text-[#0a0a0a]">2-3 L</span>
              </div>
              <div className="flex justify-between items-center gap-2 px-3 sm:px-3.5 py-3">
                <span className="text-[13px] text-gray-600 min-w-0 shrink">With dinner</span>
                <span className="text-[13px] font-semibold text-[#0a0a0a] shrink-0">500 ml</span>
              </div>
            </div>
            <div className="px-3.5 py-2.5 bg-gray-50 border-t border-gray-200">
              <p className="text-[11px] text-gray-500">Choose sodium-rich meals to support pre-loading</p>
            </div>
          </div>
        </TimelinePhaseCard>

        {/* Phase 2: Race Morning */}
        <TimelinePhaseCard timeLabel="Race morning" phaseName="Race Morning" isActive>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-100">
              <div className="flex justify-between items-center gap-2 px-3 sm:px-3.5 py-3">
                <span className="text-[13px] text-gray-600 min-w-0 shrink">-3h: Wake up</span>
                <span className="text-[13px] font-semibold text-[#0a0a0a] shrink-0 text-right">{plan.preActivity.water}ml + breakfast</span>
              </div>
              <div className="flex justify-between items-center gap-2 px-3 sm:px-3.5 py-3">
                <span className="text-[13px] text-gray-600 min-w-0 shrink">-2h: Pre-load</span>
                <span className="text-[13px] font-semibold text-[#0a0a0a] flex items-center gap-1.5">
                  200ml + <PillBadge>{plan.preActivity.electrolytes} sachet{plan.preActivity.electrolytes !== 1 ? 's' : ''}</PillBadge>
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 px-3 sm:px-3.5 py-3">
                <span className="text-[13px] text-gray-600 min-w-0 shrink">-30min: Final</span>
                <span className="text-[13px] font-semibold text-[#0a0a0a] shrink-0">Sips only</span>
              </div>
            </div>
            <div className="px-3.5 py-2.5 bg-gray-50 border-t border-gray-200">
              <p className="text-[11px] text-gray-500">Pre-loading with electrolytes reduces cramping risk by up to 30%</p>
            </div>
          </div>
        </TimelinePhaseCard>

        {/* Phase 3: During Race */}
        {!isSwimming && (
          <TimelinePhaseCard timeLabel="Race start" phaseName="During Race">
            {isTriathlon && plan.triathlonSegments ? (
              <div className="rounded-lg bg-[#0a0a0a] text-white overflow-hidden">
                <div className="p-3.5 space-y-3">
                  {/* Bike segment */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Bike — {plan.triathlonSegments.bike.distance}km</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[13px] text-gray-300">
                        {plan.triathlonSegments.bike.sachets > 0
                          ? `${plan.triathlonSegments.bike.sachets} sachet${plan.triathlonSegments.bike.sachets !== 1 ? 's' : ''} + ${safeNumber(plan.triathlonSegments.bike.fluid)}ml`
                          : `${safeNumber(plan.triathlonSegments.bike.fluid)}ml water`}
                      </span>
                      {plan.triathlonSegments.bike.sachets > 0 && (
                        <PillBadge inverted>
                          1 every {Math.round((plan.triathlonSegments.bike.duration * 60) / plan.triathlonSegments.bike.sachets)} min
                        </PillBadge>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{formatSegmentDuration(plan.triathlonSegments.bike.duration)}</p>
                  </div>

                  <div className="border-t border-gray-700" />

                  {/* Run segment */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Run — {plan.triathlonSegments.run.distance}km</p>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[13px] text-gray-300">
                        {plan.triathlonSegments.run.sachets > 0
                          ? `${plan.triathlonSegments.run.sachets} sachet${plan.triathlonSegments.run.sachets !== 1 ? 's' : ''} + ${safeNumber(plan.triathlonSegments.run.fluid)}ml`
                          : `${safeNumber(plan.triathlonSegments.run.fluid)}ml water`}
                      </span>
                      {plan.triathlonSegments.run.sachets > 0 && (
                        <PillBadge inverted>
                          1 every {Math.round((plan.triathlonSegments.run.duration * 60) / plan.triathlonSegments.run.sachets)} min
                        </PillBadge>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{formatSegmentDuration(plan.triathlonSegments.run.duration)}</p>
                  </div>
                </div>
                <div className="px-3.5 py-2.5 bg-[#1a1a1a] border-t border-gray-700">
                  <p className="text-[11px] text-gray-400">No hydration during swim — pre-load covers it. T1 is your first chance to drink.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-[#0a0a0a] text-white overflow-hidden">
                <div className="p-3.5 space-y-3">
                  {/* Course bar with individual sachet markers */}
                  {showCourseBar && (
                    <CourseDistanceBar
                      distanceKm={distanceKm}
                      sachets={sachetSchedule}
                    />
                  )}

                  {/* Sachet summary + interval pill */}
                  {plan.duringActivity.totalElectrolytes > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] text-gray-300">
                        {plan.duringActivity.totalElectrolytes} sachet{plan.duringActivity.totalElectrolytes !== 1 ? 's' : ''} during race
                      </span>
                      <PillBadge inverted>
                        1 every {plan.duringActivity.electrolytesPerHour > 0
                          ? `${Math.round(60 / plan.duringActivity.electrolytesPerHour)} min`
                          : 'session'}
                      </PillBadge>
                    </div>
                  )}

                  {/* Water instruction */}
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-gray-300">Water per hour</span>
                    <span className="text-[13px] font-semibold text-white">{safeNumber(plan.duringActivity.waterPerHour)}ml</span>
                  </div>
                </div>
                <div className="px-3.5 py-2.5 bg-[#1a1a1a] border-t border-gray-700">
                  <p className="text-[11px] text-gray-400">Sip every 10-15 min at aid stations. Small, consistent sips keep your stomach settled.</p>
                </div>
              </div>
            )}
          </TimelinePhaseCard>
        )}

        {/* Phase 4: Recovery */}
        <TimelinePhaseCard timeLabel="Finish line" phaseName="Recovery" isLast>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="divide-y divide-gray-100">
              <div className="flex justify-between items-center gap-2 px-3 sm:px-3.5 py-3">
                <span className="text-[13px] text-gray-600 min-w-0 shrink">0h: Immediately</span>
                <span className="text-[13px] font-semibold text-[#0a0a0a] flex items-center gap-1.5">
                  500ml + <PillBadge>{safeNumber(plan.postActivity.electrolytes)} sachet{safeNumber(plan.postActivity.electrolytes) !== 1 ? 's' : ''}</PillBadge>
                </span>
              </div>
              <div className="flex justify-between items-center gap-2 px-3 sm:px-3.5 py-3">
                <span className="text-[13px] text-gray-600 min-w-0 shrink">1-2h: Recover</span>
                <span className="text-[13px] font-semibold text-[#0a0a0a]">250ml + protein meal</span>
              </div>
              <div className="flex justify-between items-center gap-2 px-3 sm:px-3.5 py-3">
                <span className="text-[13px] text-gray-600 min-w-0 shrink">2-6h: Rehydrate</span>
                <span className="text-[13px] font-semibold text-[#0a0a0a]">750ml, pale urine</span>
              </div>
            </div>
          </div>
        </TimelinePhaseCard>
      </div>
    </div>
  );
}
