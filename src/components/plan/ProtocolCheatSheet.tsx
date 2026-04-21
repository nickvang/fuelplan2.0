import type { HydrationPlan, HydrationProfile } from '@/types/hydration';
import { safeNumber } from './planHelpers';
import { useLanguage } from '@/contexts/LanguageContext';

interface ProtocolCheatSheetProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
}

export function ProtocolCheatSheet({ plan, profile }: ProtocolCheatSheetProps) {
  const { t } = useLanguage();
  const waterPerHour = safeNumber(plan.duringActivity.waterPerHour);
  const duringElectrolytes = plan.duringActivity.totalElectrolytes;
  const intervalMin = plan.duringActivity.electrolytesPerHour > 0
    ? Math.round(60 / plan.duringActivity.electrolytesPerHour)
    : 0;
  const gel = plan.energyGel;
  const gelApplicable = gel?.applicable && gel.totalGels > 0;
  const isFootball = gel?.sport === 'football';

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          {t('result.cheatSheetTitle')}
        </p>

        <div className="space-y-2.5">
          {/* Before */}
          <div className="flex gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 w-14 shrink-0 pt-0.5">{t('result.before')}</span>
            <div className="space-y-0.5">
              <p className="text-[13px] text-[#0a0a0a] leading-snug">
                {plan.preActivity.water}ml water + {plan.preActivity.electrolytes} electrolyte sachet{plan.preActivity.electrolytes !== 1 ? 's' : ''}, 2h before start
              </p>
              {gelApplicable && isFootball && gel.phases.preMatch > 0 && (
                <p className="text-[13px] text-[#0a0a0a] leading-snug">
                  + {gel.phases.preMatch} energy gel{gel.phases.preMatch !== 1 ? 's' : ''} 15 min before warm-up
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* During */}
          <div className="flex gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 w-14 shrink-0 pt-0.5">{t('result.during')}</span>
            <div className="space-y-0.5">
              <p className="text-[13px] text-[#0a0a0a] leading-snug">
                {waterPerHour}ml water/hr
                {duringElectrolytes > 0 && (
                  <> + {duringElectrolytes} electrolyte sachet{duringElectrolytes !== 1 ? 's' : ''}
                    {intervalMin > 0 && <> (1 every {intervalMin}min)</>}
                  </>
                )}
              </p>
              {gelApplicable && !isFootball && gel.phases.during > 0 && (
                <p className="text-[13px] text-[#0a0a0a] leading-snug">
                  + {gel.phases.during} energy gel{gel.phases.during !== 1 ? 's' : ''} ({gel.gelsPerHour}/hr · {gel.timing.split('·')[0].trim()})
                </p>
              )}
              {gelApplicable && isFootball && gel.phases.halftime > 0 && (
                <p className="text-[13px] text-[#0a0a0a] leading-snug">
                  + {gel.phases.halftime} energy gel at half-time
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* After */}
          <div className="flex gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-400 w-14 shrink-0 pt-0.5">{t('result.after')}</span>
            <p className="text-[13px] text-[#0a0a0a] leading-snug">
              {safeNumber(plan.postActivity.water)}ml + {safeNumber(plan.postActivity.electrolytes)} electrolyte sachet{safeNumber(plan.postActivity.electrolytes) !== 1 ? 's' : ''} within 30min
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
        <p className="text-[10px] text-gray-400 text-center">{t('result.screenshotThis')}</p>
      </div>
    </div>
  );
}
