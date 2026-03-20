import { Zap, Activity } from 'lucide-react';
import type { HydrationPlan, HydrationProfile } from '@/types/hydration';

/** Shared layout for the full hydration plan – same structure in user protocol and Admin. */
export interface FullHydrationPlanProtocolProps {
  plan: HydrationPlan | null | undefined;
  profile: Partial<HydrationProfile> | null | undefined;
  /** 'admin' = dark zinc theme; 'user' = theme-aware (works on light/dark) */
  variant?: 'admin' | 'user';
  /** When true, hide the compact Race Day block (user result page has its own expanded Race Day section) */
  hideCompactRaceDay?: boolean;
}

const raceDistanceToKm = (raceDistance: string | undefined): string => {
  if (!raceDistance) return 'Not specified';
  const raceText = (raceDistance || '').toLowerCase();
  const raceDistances: Record<string, number> = {
    'half ironman': 113, 'ironman 70.3': 113, '70.3': 113,
    'ironman': 226, 'full ironman': 226, '140.6': 226,
    'olympic': 51.5, 'sprint': 25.75,
    'half marathon': 21.1, 'marathon': 42.2,
    'ultra': 50, '50k': 50, '100k': 100, '100 mile': 160, '100 miles': 160,
    '10k': 10, '5k': 5, 'century': 160,
  };
  for (const [name, dist] of Object.entries(raceDistances)) {
    if (raceText.includes(name)) return `${dist} km`;
  }
  const match = raceDistance.match(/(\d+\.?\d*)/);
  return match ? `${match[1]} km` : raceDistance;
};

const formatDuration = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

export function FullHydrationPlanProtocol({ plan, profile, variant = 'user', hideCompactRaceDay = false }: FullHydrationPlanProtocolProps) {
  const isAdmin = variant === 'admin';
  const pd = profile || {};
  const pre = plan?.preActivity;
  const during = plan?.duringActivity;
  const post = plan?.postActivity;
  const sessionDuration = pd.sessionDuration ?? 0;
  const effectiveDuration = sessionDuration >= 2 ? Math.max(0, sessionDuration - 0.5) : 0;
  const totalDuringSachets = sessionDuration >= 2 && during
    ? Math.round((during.electrolytesPerHour ?? 0) * effectiveDuration)
    : 0;
  const totalWaterDuring = Math.round((during?.waterPerHour ?? 0) * sessionDuration);

  const sodiumLossPerHour = (pd.knownSodiumLossPerHour != null && pd.knownSodiumLossPerHour >= 200 && pd.knownSodiumLossPerHour <= 2000)
    ? Math.round(pd.knownSodiumLossPerHour)
    : ({ low: 400, medium: 650, high: 1100 }[pd.sweatSaltiness ?? 'medium'] ?? 650);
  const totalSodiumLoss = sodiumLossPerHour * (sessionDuration || 1);
  const sachetsPerHour = during?.electrolytesPerHour ?? 1;

  const wrapperClass = isAdmin
    ? 'space-y-4 rounded-lg border border-zinc-700 bg-zinc-800/80 p-4'
    : 'space-y-4 rounded-xl border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-4 md:p-6 shadow-sm';
  const labelClass = isAdmin ? 'text-[10px] font-bold uppercase tracking-wider text-zinc-500' : 'text-xs font-bold uppercase tracking-wider text-muted-foreground';
  const valueClass = isAdmin ? 'font-bold text-zinc-200' : 'font-bold text-foreground';
  const cardClass = isAdmin ? 'rounded-lg border border-zinc-700 bg-zinc-900' : 'rounded-xl border border-primary/15 bg-primary/5';
  const preCardClass = isAdmin ? 'rounded-lg border border-zinc-700 bg-zinc-900' : 'rounded-xl border border-primary/20 bg-primary/5';
  const postCardClass = isAdmin ? 'rounded-lg border border-zinc-700 bg-zinc-900' : 'rounded-xl border border-primary/20 bg-muted/30';
  const duringCardClass = isAdmin ? 'rounded-lg border border-zinc-600 bg-zinc-700 text-zinc-100' : 'rounded-xl border-2 border-primary bg-primary text-primary-foreground shadow-md';
  const headingClass = isAdmin ? 'text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2' : 'text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2';
  const sectionTitleClass = isAdmin ? 'text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1' : 'text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1';
  const bigTitleClass = isAdmin ? 'text-lg font-black text-zinc-100' : 'text-2xl md:text-3xl font-black text-foreground uppercase tracking-tight';
  const duringTitleClass = isAdmin ? 'text-lg font-black' : 'text-2xl md:text-3xl font-black uppercase tracking-tight';
  const totalFluidClass = isAdmin ? 'text-3xl font-black text-zinc-100 tabular-nums' : 'text-3xl font-black text-foreground tabular-nums';
  const smallTextClass = isAdmin ? 'text-xs text-zinc-500' : 'text-xs text-muted-foreground';
  const whyDosingClass = isAdmin ? 'p-3 rounded-lg bg-zinc-900/80 border border-zinc-700 space-y-2' : 'p-3 rounded-lg bg-secondary/50 border border-border space-y-2';
  const whyTitleClass = isAdmin ? 'font-bold text-xs text-zinc-400 flex items-center gap-1' : 'font-bold text-sm flex items-center gap-1';
  const raceDayCardClass = isAdmin ? 'p-3 rounded-lg bg-zinc-900 border border-zinc-700 space-y-2' : 'p-3 rounded-lg bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/30 space-y-2';
  const recCardClass = isAdmin ? 'p-3 rounded-lg bg-zinc-900/80 border border-zinc-700' : 'p-3 rounded-lg bg-secondary/30 border border-border';

  const hasPlan = plan && (plan.preActivity || plan.duringActivity || plan.postActivity);

  return (
    <div className={wrapperClass}>
      <h4 className={headingClass}>
        <Zap className="w-4 h-4" />
        {variant === 'admin' ? 'FULL HYDRATION PLAN' : 'Full hydration plan'}
      </h4>

      {!hasPlan && (
        <p className={isAdmin ? 'text-sm text-zinc-500 py-4' : 'text-sm text-muted-foreground py-4'}>
          No hydration plan data for this submission.
        </p>
      )}

      {hasPlan && (
        <>
      {/* Single-line activity + fluid loss – clear hierarchy */}
      <div className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-sm leading-relaxed ${isAdmin ? 'text-zinc-400' : 'text-muted-foreground'}`}>
        <span className={isAdmin ? 'text-zinc-100 font-semibold' : 'text-foreground font-semibold'}>
          {(pd.disciplines ?? []).join(' + ') || '—'}
        </span>
        <span aria-hidden className="opacity-60">·</span>
        <span>{raceDistanceToKm(pd.raceDistance)}</span>
        <span aria-hidden className="opacity-60">·</span>
        <span>{formatDuration(sessionDuration)}</span>
        {pd.hasUpcomingRace && (
          <>
            <span aria-hidden className="opacity-60">·</span>
            <span className={isAdmin ? 'text-zinc-300' : 'text-foreground'}>{isAdmin ? 'Race day' : 'Race day'}</span>
          </>
        )}
        {plan.totalFluidLoss != null && plan.totalFluidLoss > 0 && (
          <>
            <span aria-hidden className="opacity-60">·</span>
            <span className={`tabular-nums font-semibold ${isAdmin ? 'text-zinc-100' : 'text-foreground'}`}>
              {Math.round(plan.totalFluidLoss / 1000 * 10) / 10} L fluid loss
            </span>
          </>
        )}
      </div>

      {/* PRE (green) / DURING / POST (red) – stack on mobile for readability */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className={`rounded-lg border-l-4 pl-3 pr-3 py-3.5 ${isAdmin ? 'border-l-brand-green/70 bg-zinc-900 border border-zinc-700' : 'border-l-primary border border-border bg-primary/[0.06]'}`}>
          <p className={`text-[11px] uppercase tracking-wider ${isAdmin ? 'text-zinc-500' : 'text-muted-foreground'} mb-1`}>
            {pre?.timing ?? '2–4h before'}
          </p>
          <p className={`text-lg font-bold ${isAdmin ? 'text-zinc-100' : 'text-foreground'}`}>Pre</p>
          <p className={`text-sm mt-1.5 leading-snug ${isAdmin ? 'text-zinc-400' : 'text-muted-foreground'}`}>
            <span className={isAdmin ? 'text-zinc-200 font-semibold tabular-nums' : 'text-foreground font-semibold tabular-nums'}>{Math.round(pre?.water ?? 0)} ml</span>
            <span className="opacity-70"> · </span>
            <span className={isAdmin ? 'text-zinc-200 font-semibold' : 'text-foreground font-semibold'}>{pre?.electrolytes ?? 0}× sachet{(pre?.electrolytes ?? 0) !== 1 ? 's' : ''}</span>
          </p>
        </div>

        {!(pd.disciplines?.includes('Swimming') && pd.hasUpcomingRace) && (
          <div className={`rounded-lg border border-border pl-3 pr-3 py-3.5 ${isAdmin ? 'bg-zinc-700 border-zinc-600' : 'bg-muted/40'}`}>
            <p className={`text-[11px] uppercase tracking-wider mb-1 ${isAdmin ? 'text-zinc-400' : 'text-muted-foreground'}`}>
              {during?.frequency ?? 'Every 12–15 min'}
            </p>
            <p className={`text-lg font-bold ${isAdmin ? 'text-zinc-100' : 'text-foreground'}`}>During</p>
            <p className={`text-sm mt-1.5 leading-snug ${isAdmin ? 'text-zinc-400' : 'text-muted-foreground'}`}>
              <span className={isAdmin ? 'text-zinc-200 font-semibold tabular-nums' : 'text-foreground font-semibold tabular-nums'}>{Math.round(during?.waterPerHour ?? 0)} ml/hr</span>
              <span className="opacity-70"> · </span>
              <span className={isAdmin ? 'text-zinc-200 font-semibold tabular-nums' : 'text-foreground font-semibold tabular-nums'}>{totalWaterDuring} ml</span> total
              <br />
              <span className={isAdmin ? 'text-zinc-200 font-semibold' : 'text-foreground font-semibold'}>{during?.electrolytesPerHour ?? 0} sachet/hr</span>
              <span className="opacity-70"> · </span>
              <span className={isAdmin ? 'text-zinc-200 font-semibold' : 'text-foreground font-semibold'}>{totalDuringSachets} total</span>
            </p>
          </div>
        )}

        <div className={`rounded-lg border-l-4 pl-3 pr-3 py-3.5 ${isAdmin ? 'border-l-brand-red/70 bg-zinc-900 border border-zinc-700' : 'border-l-muted-foreground border border-border bg-muted/20'}`}>
          <p className={`text-[11px] uppercase tracking-wider mb-1 ${isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}`}>
            {post?.timing ?? 'Within 30 min'}
          </p>
          <p className={`text-lg font-bold ${isAdmin ? 'text-zinc-100' : 'text-foreground'}`}>Post</p>
          <p className={`text-sm mt-1.5 leading-snug ${isAdmin ? 'text-zinc-400' : 'text-muted-foreground'}`}>
            <span className={isAdmin ? 'text-zinc-200 font-semibold tabular-nums' : 'text-foreground font-semibold tabular-nums'}>{Math.round(post?.water ?? 0)} ml</span>
            <span className="opacity-70"> · </span>
            <span className={isAdmin ? 'text-zinc-200 font-semibold' : 'text-foreground font-semibold'}>{post?.electrolytes ?? 0}× sachet{(post?.electrolytes ?? 0) !== 1 ? 's' : ''}</span>
          </p>
        </div>
      </div>

      {/* Why this dosing – hidden on user result page (cleaner view) */}
      {!hideCompactRaceDay && (
      <div className={whyDosingClass}>
        <h5 className={whyTitleClass}>
          <Activity className="w-3 h-3" /> Why this dosing
        </h5>
        <div className={`text-xs space-y-1 ${isAdmin ? 'text-zinc-400' : 'text-muted-foreground'}`}>
          <p>
            Sodium loss: ~{sodiumLossPerHour} mg/hr ({pd.sweatSaltiness ?? 'medium'}) → <strong className={isAdmin ? 'text-zinc-200' : 'text-foreground'}>{Math.round(totalSodiumLoss)} mg total</strong>
          </p>
          <p>Calculation: {sodiumLossPerHour} ÷ 500 ≈ {Math.round(sodiumLossPerHour / 500 * 10) / 10} sachets/hr</p>
          <p>Adjustments: weight {pd.weight ?? '—'} kg, temp {pd.trainingTempRange?.min ?? '—'}–{pd.trainingTempRange?.max ?? '—'}°C, sweat {pd.sweatRate ?? '—'}</p>
          <p>Result: <strong className={isAdmin ? 'text-zinc-200' : 'text-foreground'}>{sachetsPerHour} sachet{sachetsPerHour !== 1 ? 's' : ''}/hr</strong></p>
          {sessionDuration < 2 && (
            <p className={isAdmin ? 'text-amber-400/90 font-medium' : 'text-primary font-semibold'}>
              Under 2 hr: sachets in pre + post only
            </p>
          )}
        </div>
      </div>
      )}

      {/* Race day (48h) – hidden on user result page (they have expanded Race Day section below) */}
      {pd.hasUpcomingRace && !hideCompactRaceDay && (
        <div className={raceDayCardClass}>
          <h5 className={isAdmin ? 'font-bold text-xs text-zinc-400 mb-2' : 'font-bold text-sm text-primary mb-2'}>
            Race Day Protocol — Your 48-hour strategy
          </h5>
          <div className="space-y-3">
            {/* 1. Day Before (T-24) */}
            <div className={isAdmin ? 'rounded-lg border border-zinc-700 bg-zinc-800/80 p-3' : 'rounded-xl border border-border bg-muted/30 p-3'}>
              <p className={`text-xs font-black uppercase tracking-tight ${isAdmin ? 'text-zinc-200' : 'text-foreground'}`}>1. Day Before</p>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}`}>T-24 hours</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className={isAdmin ? 'p-2 rounded bg-zinc-900 border border-zinc-700' : 'p-2 rounded bg-muted/50 border border-border'}>
                  <p className={isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}>Hydrate</p>
                  <p className={`font-black ${isAdmin ? 'text-zinc-100' : 'text-foreground'}`}>2–3 L</p>
                  <p className={`text-[10px] ${isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}`}>Throughout day</p>
                </div>
                <div className={isAdmin ? 'p-2 rounded bg-zinc-900 border border-zinc-700' : 'p-2 rounded bg-muted/50 border border-border'}>
                  <p className={isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}>With dinner</p>
                  <p className={`font-black ${isAdmin ? 'text-zinc-100' : 'text-foreground'}`}>500 ml + 2× Supplme</p>
                  <p className={`text-[10px] ${isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}`}>5–7 pm</p>
                </div>
              </div>
              <p className={`text-[10px] mt-2 italic ${isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}`}>Avoid alcohol, new foods, late caffeine.</p>
            </div>

            {/* 2. Race Morning (T-3) */}
            <div className={isAdmin ? 'rounded-lg border border-zinc-700 bg-zinc-800/80 p-3' : 'rounded-xl border border-border bg-muted/30 p-3'}>
              <p className={`text-xs font-black uppercase tracking-tight ${isAdmin ? 'text-zinc-200' : 'text-foreground'}`}>2. Race Morning</p>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}`}>T-3 hours</p>
              <div className="mt-2 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`font-black tabular-nums shrink-0 ${isAdmin ? 'text-zinc-300' : 'text-primary'}`}>-3h</span>
                  <p>{(pre?.water ?? 500)} ml + breakfast</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-black tabular-nums shrink-0 ${isAdmin ? 'text-zinc-300' : 'text-primary'}`}>-2h</span>
                  <p>{(pre?.electrolytes ?? 1)}× Supplme + 300 ml</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-black tabular-nums shrink-0 ${isAdmin ? 'text-zinc-300' : 'text-primary'}`}>-30m</span>
                  <p>Small sips only (100–150 ml)</p>
                </div>
              </div>
            </div>

            {/* 3. During Race (same as user’s “During Race” section) */}
            {!(pd.disciplines?.includes('Swimming')) && (
              <div className={isAdmin ? 'rounded-lg border border-zinc-600 bg-zinc-700 p-3 text-zinc-100' : 'rounded-xl border-2 border-foreground bg-foreground text-background p-3'}>
                <p className="text-xs font-black uppercase tracking-tight">3. During Race</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className={isAdmin ? 'text-zinc-400' : 'text-background/70'}>Water per hour</p>
                    <p className="font-black">{(during?.waterPerHour ?? 0)} ml</p>
                    <p className="text-[10px] opacity-80">Sip {(during?.frequency ?? 'every 12–15 min').toLowerCase()}</p>
                  </div>
                  <div>
                    <p className={isAdmin ? 'text-zinc-400' : 'text-background/70'}>Supplme total</p>
                    <p className="font-black">{totalDuringSachets} sachet{totalDuringSachets !== 1 ? 's' : ''}</p>
                    {during && (during.electrolytesPerHour ?? 0) > 0 && (
                      <p className="text-[10px] opacity-80">1 every {Math.round(60 / (during.electrolytesPerHour ?? 1))} min</p>
                    )}
                  </div>
                </div>
                {pd.disciplines?.[0] === 'Triathlon' && totalDuringSachets > 0 && (
                  <p className="text-[10px] mt-2 opacity-90">Bike + run only (none during swim).</p>
                )}
              </div>
            )}

            {/* 4. Recovery (same as user’s Recovery section) */}
            <div className={isAdmin ? 'rounded-lg border border-zinc-700 bg-zinc-800/80 p-3' : 'rounded-xl border border-border bg-muted/30 p-3'}>
              <p className={`text-xs font-black uppercase tracking-tight ${isAdmin ? 'text-zinc-200' : 'text-foreground'}`}>4. Recovery</p>
              <p className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}`}>4–6 hour window</p>
              <div className="mt-2 space-y-2 text-xs">
                <p><strong className={isAdmin ? 'text-zinc-200' : 'text-foreground'}>Immediate:</strong> 500 ml + {(post?.electrolytes ?? 0)}× Supplme</p>
                <p><strong className={isAdmin ? 'text-zinc-200' : 'text-foreground'}>First phase:</strong> {Math.round((post?.water ?? 0) * 0.5)} ml + protein meal</p>
                <p><strong className={isAdmin ? 'text-zinc-200' : 'text-foreground'}>Complete:</strong> {(post?.water ?? 0)} ml total (150% of loss)</p>
              </div>
              <p className={`text-[10px] mt-2 ${isAdmin ? 'text-zinc-500' : 'text-muted-foreground'}`}>When: {post?.timing ?? 'Within 30 min'}. Have sachets with recovery water over 4–6 h.</p>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations – hidden on user result page (cleaner view) */}
      {!hideCompactRaceDay && plan.recommendations && plan.recommendations.length > 0 && (
        <div className={recCardClass}>
          <h5 className={isAdmin ? 'font-bold text-xs text-zinc-400 mb-2' : 'font-bold text-sm mb-2'}>Recommendations</h5>
          <ul className={`text-xs space-y-1 list-disc list-inside ${isAdmin ? 'text-zinc-400' : 'text-muted-foreground'}`}>
            {plan.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
        </>
      )}
    </div>
  );
}
