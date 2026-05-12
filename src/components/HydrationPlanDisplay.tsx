import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HydrationPlan, HydrationProfile, AIEnhancedInsights } from '@/types/hydration';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRace } from '@/contexts/RaceContext';
import { generateFuelPlanImage } from '@/components/ShareCard';
import { Download, Copy, Mail } from 'lucide-react';
import { SupplmeIcon, SupplmeWordmark } from '@/components/SupplmeBrandAssets';


import { SUPPLME_ELECTROLYTE_SPEC, SUPPLME_GEL_SPEC } from '@/types/hydration';
import { parseDistanceKm, safeNumber, buildActivityLabel, computeTotalSachets, formatHoursAsTime, computeDuringSachetSchedule } from '@/components/plan/planHelpers';
import { CourseDistanceBar } from '@/components/plan/CourseDistanceBar';
import { SupplmeSummaryCard } from '@/components/plan/SupplmeSummaryCard';
import { ProtocolCheatSheet } from '@/components/plan/ProtocolCheatSheet';
import { TimelineSection } from '@/components/plan/TimelineSection';
import { PlanFooter } from '@/components/plan/PlanFooter';

interface HydrationPlanDisplayProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
  onReset: () => void;
  onFullReset?: () => void;
  hasSmartWatchData?: boolean;
  hasStrava?: boolean;
  rawSmartWatchData?: any;
  version?: 'simple' | 'pro';
}

export function HydrationPlanDisplay({ plan: initialPlan, profile: initialProfile, onReset, onFullReset, hasSmartWatchData = false, hasStrava = false, rawSmartWatchData, version }: HydrationPlanDisplayProps) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { selectedRace } = useRace();
  const { toast } = useToast();

  const [plan] = useState(initialPlan);
  const [profile] = useState(initialProfile);
  const [aiInsights, setAiInsights] = useState<AIEnhancedInsights | null>(null);
  const [activeStageDay, setActiveStageDay] = useState<number>(0);

  // Stage race detection from selectedRace
  const isStageRace = !!(selectedRace && (selectedRace as any).is_stage_race && Array.isArray((selectedRace as any).stages));
  interface StageInfo { day: number; name: string; distance_km: number; typical_duration_h: { min: number; max: number }; queen?: boolean; }
  const stageRaceStages: StageInfo[] = isStageRace ? (selectedRace as any).stages : [];
  const stageDurationsFromProfile = (profile as any).stageDurations as Record<number, number> | undefined;
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  const distanceKm = parseDistanceKm(profile.raceDistance);
  const isTriathlon = profile.disciplines?.[0] === 'Triathlon' && !!plan.triathlonSegments;
  const isSwimming = profile.disciplines?.includes('Swimming') && !isTriathlon;
  const activityLabel = buildActivityLabel(profile, selectedRace);
  const totalSachets = computeTotalSachets(plan);
  const isRacePlan = !!profile.hasUpcomingRace || !!profile.raceDistance;

  // For stage races: compute totals across ALL stage days for hero numbers
  const getStageDur = (stage: StageInfo) =>
    (stageDurationsFromProfile?.[stage.day] != null)
      ? stageDurationsFromProfile[stage.day]
      : Math.round(((stage.typical_duration_h.min + stage.typical_duration_h.max) / 2) * 10) / 10;

  const stageRaceTotals = isStageRace && stageRaceStages.length > 0
    ? stageRaceStages.reduce(
        (acc, stage) => {
          const dur = getStageDur(stage);
          const effectiveDur = Math.max(0, dur - 0.5);
          const duringSachets = Math.round(plan.duringActivity.electrolytesPerHour * effectiveDur);
          const hourlyLoss = profile.sessionDuration > 0 ? plan.totalFluidLoss / profile.sessionDuration : 0;
          return {
            pre: acc.pre + plan.preActivity.electrolytes,
            during: acc.during + duringSachets,
            post: acc.post + plan.postActivity.electrolytes,
            fluidLoss: acc.fluidLoss + hourlyLoss * dur,
            duration: acc.duration + dur,
            stages: acc.stages + 1,
          };
        },
        { pre: 0, during: 0, post: 0, fluidLoss: 0, duration: 0, stages: 0 }
      )
    : null;

  const displayTotalSachets = stageRaceTotals
    ? stageRaceTotals.pre + stageRaceTotals.during + stageRaceTotals.post
    : totalSachets;
  const displayFluidLoss = stageRaceTotals ? stageRaceTotals.fluidLoss : plan.totalFluidLoss;
  const displayDuration = stageRaceTotals ? stageRaceTotals.duration : profile.sessionDuration;
  // Scroll-aware sticky bar: show when hero numbers scroll out of viewport
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowStickyBar(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fetch AI insights
  useEffect(() => {
    const minLoadingMs = 1500;
    const startedAt = Date.now();

    const fetchAIInsights = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('enhance-hydration-plan', {
          body: { profile, plan, hasSmartWatchData, rawSmartWatchData }
        });
        if (error) throw error;
        if (data?.code === 'SERVICE_UNAVAILABLE' || data?.error) {
          throw new Error(data.error || data.message || 'AI service unavailable');
        }
        setAiInsights(data);
      } catch (error: any) {
        if (import.meta.env.DEV) {
          const msg = error?.message || error?.error_description || String(error);
          console.error('[Profile Analysis]', msg);
        }
      } finally {
        const elapsed = Date.now() - startedAt;
        const remaining = Math.max(0, minLoadingMs - elapsed);
        if (remaining > 0) {
          setTimeout(() => setLoadingInsights(false), remaining);
        } else {
          setLoadingInsights(false);
        }
      }
    };

    fetchAIInsights();
  }, [plan, profile, hasSmartWatchData, rawSmartWatchData]);

  const handleDeleteMyData = async () => {
    if (!confirm(t('result.deleteConfirm'))) return;
    try {
      const deletionToken = localStorage.getItem('hydration_deletion_token');
      if (!deletionToken) {
        toast({ title: t('result.cannotDeleteTitle'), description: t('result.cannotDeleteDescription'), variant: "destructive" });
        return;
      }
      const { error } = await supabase.functions.invoke('delete-user-data', {
        body: { confirmDelete: true, deletionToken }
      });
      if (error) throw error;
      localStorage.removeItem('hydration_deletion_token');
      toast({ title: t('gdpr.toastDeletedTitle'), description: t('gdpr.toastDeletedDescription') });
      setTimeout(() => onReset(), 2000);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to delete data:', error);
      toast({ title: t('gdpr.toastDeletionFailedTitle'), description: t('gdpr.toastDeletionFailedDescription'), variant: "destructive" });
    }
  };

  const handleExportMyData = async () => {
    const deletionToken = localStorage.getItem('hydration_deletion_token');
    if (!deletionToken) {
      toast({ title: t('gdpr.exportNoDataTitle'), description: t('gdpr.exportNoDataDescription') });
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('export-my-data', {
        body: { exportToken: deletionToken }
      });
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'my-supplme-data.json';
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: t('gdpr.exportSuccessTitle'), description: t('gdpr.exportSuccessDescription') });
    } catch (error) {
      if (import.meta.env.DEV) console.error('Failed to export data:', error);
      toast({ title: t('gdpr.exportErrorTitle'), description: t('gdpr.exportErrorDescription'), variant: "destructive" });
    }
  };

  // Build shareable text summary
  const buildShareText = useCallback(() => {
    const sport = profile.disciplines?.[0] || 'Activity';
    const pre = `Pre: ${plan.preActivity.water}ml water + ${plan.preActivity.electrolytes} sachet${plan.preActivity.electrolytes !== 1 ? 's' : ''}`;
    const during = `During: ${safeNumber(plan.duringActivity.waterPerHour)}ml water/hr${plan.duringActivity.totalElectrolytes > 0 ? ` + ${plan.duringActivity.totalElectrolytes} sachet${plan.duringActivity.totalElectrolytes !== 1 ? 's' : ''}` : ''}`;
    const post = `Post: ${safeNumber(plan.postActivity.water)}ml water + ${safeNumber(plan.postActivity.electrolytes)} sachet${safeNumber(plan.postActivity.electrolytes) !== 1 ? 's' : ''}`;
    return `My ${sport} hydration plan: ${pre}. ${during}. ${post}. Generated at fuelplan.supplme.dk`;
  }, [plan, profile]);

  const handleSaveImage = async () => {
    setIsSharing(true);
    try {
      toast({ title: t('result.generatingImageTitle'), description: t('result.generatingImageDescription') });
      const blob = await generateFuelPlanImage(plan, profile, distanceKm, selectedRace, language);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `supplme-plan-${distanceKm}km.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: t('result.imageSavedTitle'), description: t('result.imageSavedDescription') });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({ title: t('result.shareFailedTitle'), description: t('result.shareFailedDescription'), variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  const handleEmailPlan = async () => {
    if (!user?.email) return;
    try {
      const { error } = await supabase.functions.invoke('send-plan-email', {
        body: { toEmail: user.email, plan, profile, distanceKm }
      });
      if (error) throw error;
      toast({ title: t('home.emailSent'), description: t('home.emailSentDescription') });
    } catch {
      toast({ title: t('result.shareFailedTitle'), description: t('result.shareFailedDescription'), variant: "destructive" });
    }
  };

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText());
      toast({ title: t('result.copiedTitle'), description: t('result.copiedDescription') });
    } catch {
      toast({ title: t('result.shareFailedTitle'), variant: "destructive" });
    }
  };

  return (
    <div className="max-w-[540px] mx-auto bg-white pb-24 sm:pb-8 animate-in fade-in duration-500" ref={heroRef}>

      {/* ── 1. Brand header ── */}
      <header className="flex justify-between items-center px-5 pt-[52px] pb-4 border-b border-black/10">
        <div className="flex items-center gap-2.5">
          <SupplmeIcon size={22} />
          <SupplmeWordmark height={14} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-[6px] h-[6px] rounded-full bg-[#2ecc71] inline-block" />
          <span className="font-mono text-[9px] tracking-[1.4px] text-[#8A9099] whitespace-nowrap uppercase">Plan Ready</span>
        </div>
      </header>

      {/* ── 2. Race label + headline ── */}
      <div className="px-5 pt-[22px]">
        <p className="font-mono text-[9px] tracking-[2px] text-[#8A9099] uppercase">
          {activityLabel}{selectedRace?.name ? ` · ${selectedRace.name}` : ''} · {formatHoursAsTime(displayDuration).slice(0, -3)}
        </p>
        <h1 className="font-display font-semibold text-[46px] leading-[0.94] tracking-tight uppercase text-[#0A0A0A] mt-2.5">
          Race-day<br/>protocol
        </h1>
      </div>

      {/* ── 3. Hydration stat block (silver band) ── */}
      <section className="px-5 pt-[22px]">
        <p className="font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase mb-2">Hydration</p>
        <div className="grid grid-cols-3 bg-[#CBD0D6]">
          {[
            [String(displayTotalSachets) + '×', 'ELECTROLYTE'],
            [`${(safeNumber(displayFluidLoss)/1000).toFixed(1)}L`, 'FLUID LOSS'],
            [`${displayTotalSachets * SUPPLME_ELECTROLYTE_SPEC.sodium}mg`, 'SODIUM'],
          ].map(([n,l],i)=>(
            <div key={i} className={`p-3 ${i?'border-l border-black/10':''}`}>
              <div className="font-display font-bold text-[28px] leading-none tabular-nums text-[#0A0A0A]">{n}</div>
              <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#0A0A0A]/55 mt-1">{l}</div>
            </div>
          ))}
        </div>
        <div className="bg-[#0A0A0A] text-white px-3 py-2.5 flex justify-between">
          <span className="font-mono text-[9px] tracking-[1.2px] opacity-55">
            {hasStrava ? 'Strava calibrated' : 'Science-based'}
          </span>
          <span className="font-mono text-[10px] tabular-nums">
            {plan.calibrationApplied ? `${plan.calibrationApplied.sodiumAdjustPct >= 0 ? '+' : ''}${plan.calibrationApplied.sodiumAdjustPct}% · ${plan.calibrationApplied.dataPoints} acts.` : 'ACSM protocol'}
          </span>
        </div>
      </section>

      {/* ── 4. Carbohydrates stat block ── */}
      {plan.energyGel?.applicable && (
        <section className="px-5 pt-4">
          <p className="font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase mb-2">Carbohydrates</p>
          <div className="grid grid-cols-3 border border-black/10">
            {[
              [`${plan.energyGel.totalGels}×`, 'GEL SACHETS'],
              [`${plan.energyGel.totalCarbsG}g`, 'TOTAL CARBS'],
              [String(plan.energyGel.totalKcal), 'KCAL'],
            ].map(([n,l],i)=>(
              <div key={i} className={`p-3 ${i?'border-l border-black/10':''}`}>
                <div className="font-display font-bold text-[28px] leading-none tabular-nums text-[#0A0A0A]">{n}</div>
                <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#8A9099] mt-1">{l}</div>
              </div>
            ))}
          </div>
          <div className="bg-[#F7F8F9] border border-t-0 border-black/10 px-3 py-2.5 flex justify-between">
            <span className="font-mono text-[9px] text-[#8A9099]">2:1 fructose:glucose</span>
            <span className="font-mono text-[9px] text-[#8A9099]">Liposomal delivery</span>
          </div>
        </section>
      )}

      {/* ── 5. Save / share actions ── */}
      <section className="px-5 pt-5">
        <button
          onClick={handleSaveImage}
          disabled={isSharing}
          className="w-full bg-[#0A0A0A] text-white px-4 py-4 flex justify-between items-center disabled:opacity-50"
        >
          <span className="font-display font-semibold text-[18px] uppercase tracking-wide">Save plan</span>
          <span className="font-mono text-[9px] opacity-55 tracking-[1px]">PNG · PDF</span>
        </button>
        <div className="grid grid-cols-3 gap-px bg-black/10 mt-px">
          {user?.email && (
            <button
              onClick={handleEmailPlan}
              className="bg-white py-3 font-mono text-[9px] tracking-[1.5px] uppercase text-[#0A0A0A]"
            >
              Email
            </button>
          )}
          <button
            onClick={async () => {
              try {
                await navigator.share({ title: 'My FuelPlan', text: buildShareText() });
              } catch { handleCopyToClipboard(); }
            }}
            className="bg-white py-3 font-mono text-[9px] tracking-[1.5px] uppercase text-[#0A0A0A]"
          >
            Share
          </button>
          <button
            onClick={handleCopyToClipboard}
            className="bg-white py-3 font-mono text-[9px] tracking-[1.5px] uppercase text-[#0A0A0A]"
          >
            Copy
          </button>
        </div>
      </section>

      {/* ── 6. Protocol timeline (direct, no accordion) ── */}
      <section className="px-5 pt-7">
        <div className="flex justify-between font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase mb-2.5">
          <span>Protocol · chrono</span>
          <span>{t('result.raceDayProtocol')}</span>
        </div>
        <div className="border border-black/10">
          <div className="px-3.5 py-1.5 bg-[#0A0A0A]/85 font-mono text-[9px] tracking-[2px] font-semibold uppercase text-white">
            Race day
          </div>
          <div className="px-4 py-4">
            {/* Stage race nav */}
            {isStageRace && (
              <nav className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveStageDay(0)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors ${
                    activeStageDay === 0
                      ? 'bg-[#0a0a0a] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t('result.dayBefore')}
                </button>
                {stageRaceStages.map((stage) => (
                  <button
                    key={stage.day}
                    onClick={() => setActiveStageDay(stage.day)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors border ${
                      stage.queen
                        ? activeStageDay === stage.day
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-amber-50 text-amber-700 border-amber-400/60 hover:bg-amber-100'
                        : activeStageDay === stage.day
                        ? 'bg-[#0a0a0a] text-white border-[#0a0a0a]'
                        : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    {stage.name}
                  </button>
                ))}
              </nav>
            )}

            {/* Stage-specific protocol (shown when a stage is selected) */}
            {isStageRace && activeStageDay > 0 && (() => {
              const activeStage = stageRaceStages.find(s => s.day === activeStageDay);
              if (!activeStage) return null;
              const isQueenStage = !!activeStage.queen;
              const isLastStage = activeStage.day === Math.max(...stageRaceStages.map(s => s.day));

              // Use per-stage plan from calculator when available, fall back to base plan
              const sp = plan.stagePlans?.[activeStage.day];
              const stageDuration = sp?.stageDuration
                ?? ((stageDurationsFromProfile && stageDurationsFromProfile[activeStage.day] != null)
                  ? stageDurationsFromProfile[activeStage.day]
                  : Math.round(((activeStage.typical_duration_h.min + activeStage.typical_duration_h.max) / 2) * 10) / 10);
              const stageWaterPerHour = sp?.waterPerHour ?? plan.duringActivity.waterPerHour;
              const stageSachetsPerHour = sp?.electrolytesPerHour ?? plan.duringActivity.electrolytesPerHour;
              const stageTotalSachets = sp?.totalElectrolytes ?? Math.round(plan.duringActivity.electrolytesPerHour * stageDuration);
              const stageFluidLossL = sp ? (sp.totalFluidLoss / 1000) : (plan.totalFluidLoss / 1000);

              return (
                <div className="space-y-4">
                  {/* Stage Morning */}
                  <div className={`rounded-2xl border ${isQueenStage ? 'border-amber-400/60' : 'border-gray-200'} bg-card overflow-hidden`}>
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${isQueenStage ? 'bg-amber-500' : 'bg-[#0a0a0a]'}`}>1</span>
                      <p className={`text-[13px] font-bold uppercase tracking-wide truncate min-w-0 ${isQueenStage ? 'text-amber-700' : 'text-[#0a0a0a]'}`}>{t('result.stageMorning')}</p>
                      <p className="text-[11px] text-gray-400 ml-auto shrink-0">2–3h before start</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex justify-between items-center px-4 py-3 border-l-4 border-primary bg-primary/10">
                        <span className="text-[13px] text-gray-600">-3h: Wake-up water</span>
                        <span className="text-[13px] font-semibold text-[#0a0a0a]">{plan.preActivity.water}ml water</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 border-l-4 border-primary bg-primary/10">
                        <span className="text-[13px] text-gray-600">-2h: Pre-load sachet</span>
                        <span className="text-[13px] font-semibold text-[#0a0a0a]">{plan.preActivity.electrolytes} sachet{plan.preActivity.electrolytes !== 1 ? 's' : ''} + 300ml water</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 border-l-4 border-primary bg-primary/10">
                        <span className="text-[13px] text-gray-600">-30min: Final sips</span>
                        <span className="text-[13px] font-semibold text-[#0a0a0a]">Sips only</span>
                      </div>
                    </div>
                    <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 space-y-0.5">
                      <p className="text-[11px] text-gray-500"><span className="font-semibold">When:</span> Before each stage — even if legs are fatigued from previous days.</p>
                      <p className="text-[11px] text-gray-400 italic">Tip: Multi-day races deplete glycogen and sodium daily. Consistent pre-loading prevents cumulative dehydration.</p>
                    </div>
                  </div>

                  {/* During Stage */}
                  {(() => {
                    const stagePlanForSchedule = { ...plan, duringActivity: { ...plan.duringActivity, totalElectrolytes: stageTotalSachets, electrolytesPerHour: stageSachetsPerHour, waterPerHour: stageWaterPerHour } };
                    const stageProfileForSchedule = { ...profile, sessionDuration: stageDuration, raceDistance: 'stage' } as any;
                    const stageSachetSchedule = computeDuringSachetSchedule(stagePlanForSchedule as any, stageProfileForSchedule, activeStage.distance_km);
                    const showStageCourseBar = activeStage.distance_km >= 5 && stageSachetSchedule.length > 0;
                    return (
                      <div className="rounded-2xl border-2 border-gray-700 bg-zinc-900 text-white overflow-hidden shadow-xl">
                        <div className="px-4 py-3 bg-zinc-800/80 border-b border-zinc-700 flex items-center gap-2 min-w-0">
                          <span className="w-6 h-6 rounded-full bg-white text-[#0a0a0a] flex items-center justify-center text-[11px] font-bold shrink-0">2</span>
                          <p className="text-[13px] font-bold uppercase tracking-wide text-white truncate min-w-0">{t('result.duringStage', { day: activeStage.day })}</p>
                          <p className="text-[11px] text-zinc-400 ml-auto shrink-0">{activeStage.distance_km}km · ~{stageDuration}h</p>
                        </div>
                        <div className="p-3.5 space-y-3">
                          {showStageCourseBar && (
                            <CourseDistanceBar
                              distanceKm={activeStage.distance_km}
                              sachets={stageSachetSchedule}
                            />
                          )}
                          {stageTotalSachets > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-[13px] text-gray-300">
                                {stageTotalSachets} sachet{stageTotalSachets !== 1 ? 's' : ''} during stage
                              </span>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide bg-white text-[#0a0a0a]">
                                1 every {stageSachetsPerHour > 0 ? `${Math.round(60 / stageSachetsPerHour)} min` : 'session'}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-[13px] text-gray-300">Water per hour</span>
                            <span className="text-[13px] font-semibold text-white">{stageWaterPerHour}ml water</span>
                          </div>
                        </div>
                        <div className="px-3.5 py-2.5 bg-zinc-800/60 border-t border-zinc-700 space-y-0.5">
                          <p className="text-[11px] text-zinc-300">Sip every 10–15 min at aid stations. Small, consistent sips keep your stomach settled.</p>
                          {isQueenStage && (
                            <p className="text-[11px] text-amber-300 italic">{t('result.queenStageWarning')}</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Post Stage */}
                  <div className={`rounded-2xl border ${isQueenStage ? 'border-amber-400/60' : 'border-gray-200'} bg-card overflow-hidden`}>
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${isQueenStage ? 'bg-amber-500' : 'bg-[#0a0a0a]'}`}>3</span>
                      <p className={`text-[13px] font-bold uppercase tracking-wide truncate min-w-0 ${isQueenStage ? 'text-amber-700' : 'text-[#0a0a0a]'}`}>Post-Stage Recovery</p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      <div className="flex justify-between items-center px-4 py-3 border-l-4 border-primary bg-primary/10">
                        <span className="text-[13px] text-gray-600">+0m: Immediately</span>
                        <span className="text-[13px] font-semibold text-[#0a0a0a]">500ml water</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 border-l-4 border-primary bg-primary/10">
                        <span className="text-[13px] text-gray-600">+30m: Recover</span>
                        <span className="text-[13px] font-semibold text-[#0a0a0a]">1 sachet + 300ml water</span>
                      </div>
                      <div className="flex justify-between items-center px-4 py-3 border-l-4 border-primary bg-primary/10">
                        <span className="text-[13px] text-gray-600">Evening</span>
                        <span className="text-[13px] font-semibold text-[#0a0a0a]">
                          {isLastStage ? 'You finished!' : 'Pre-load for tomorrow'}
                        </span>
                      </div>
                    </div>
                    <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 space-y-0.5">
                      <p className="text-[11px] text-gray-500"><span className="font-semibold">When:</span> Immediately after crossing the finish line each day.</p>
                      <p className="text-[11px] text-gray-400 italic">
                        {isLastStage
                          ? 'Final stage complete — continue rehydrating over the next 4–6 hours to fully restore fluid balance.'
                          : 'Recovery sodium tonight directly improves your performance tomorrow. Don\'t skip the evening sachet.'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Day Before — stage race only: hydration guidance without during-race content */}
            {isStageRace && activeStageDay === 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-3 py-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                    <div className="w-px flex-1 bg-gray-200 mt-1" style={{ minHeight: 24 }} />
                  </div>
                  <div className="flex-1 pb-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">T-24 hours</p>
                    <p className="text-[15px] font-bold text-[#0a0a0a] mb-2">{t('result.dayBefore')}</p>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="divide-y divide-gray-100">
                        <div className="flex justify-between items-center px-3.5 py-3">
                          <span className="text-[13px] text-gray-600">Water throughout the day</span>
                          <span className="text-[13px] font-semibold text-[#0a0a0a]">2-3 L</span>
                        </div>
                        <div className="flex justify-between items-center px-3.5 py-3">
                          <span className="text-[13px] text-gray-600">With dinner</span>
                          <span className="text-[13px] font-semibold text-[#0a0a0a]">500 ml water</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Standard protocol — shown for non-stage races */}
            {!isStageRace && (
              <TimelineSection
                plan={plan}
                profile={profile}
                distanceKm={distanceKm}
                isSwimming={!!isSwimming}
                isTriathlon={isTriathlon}
              />
            )}
          </div>{/* end protocol content */}
        </div>{/* end border container */}
      </section>{/* end protocol section */}

      {/* Shop now CTA */}
      <section className="px-5 pt-5">
        <a
          href="https://www.supplme.com/collections/supplme-products"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full bg-[#0A0A0A] text-white px-5 py-4 flex justify-between items-center"
        >
          <div>
            <div className="font-mono text-[9px] tracking-[1.8px] text-white/50 uppercase mb-1">Get your sachets</div>
            <div className="font-display font-semibold text-[20px] uppercase tracking-wide">Shop Supplme now</div>
          </div>
          <span className="font-mono text-[10px] opacity-50 tracking-[1px]">→</span>
        </a>

        {/* Product breakdown */}
        <div className="grid grid-cols-2 gap-px bg-black/10 mt-px">
          {/* Electrolyte sachet */}
          <div className="bg-[#F7F8F9] px-4 py-4">
            <p className="font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase mb-2.5">Electrolyte sachet</p>
            <ul className="space-y-1.5">
              {[
                [`${SUPPLME_ELECTROLYTE_SPEC.sodium}mg`, 'Sodium'],
                [`${SUPPLME_ELECTROLYTE_SPEC.potassium}mg`, 'Potassium'],
                [`${SUPPLME_ELECTROLYTE_SPEC.magnesium}mg`, 'Magnesium'],
                [`${SUPPLME_ELECTROLYTE_SPEC.chloride}mg`, 'Chloride'],
                [`${SUPPLME_ELECTROLYTE_SPEC.citrate}mg`, 'Citrate'],
              ].map(([val, label]) => (
                <li key={label} className="flex justify-between items-baseline">
                  <span className="text-[12px] text-[#2E2E2E]">{label}</span>
                  <span className="font-mono text-[10px] text-[#0A0A0A] tabular-nums">{val}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Energy gel */}
          <div className="bg-[#F7F8F9] px-4 py-4">
            <p className="font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase mb-2.5">Liquid energy gel</p>
            <ul className="space-y-1.5">
              {[
                [`${SUPPLME_GEL_SPEC.carbsPerGel}g`, 'Carbohydrates'],
                [`${SUPPLME_GEL_SPEC.glucosePerGel}g`, 'Glucose'],
                [`${SUPPLME_GEL_SPEC.fructosePerGel}g`, 'Fructose'],
                [`${SUPPLME_GEL_SPEC.kcalPerGel}`, 'kcal'],
                [`${SUPPLME_GEL_SPEC.volumeMl}ml`, 'Volume'],
              ].map(([val, label]) => (
                <li key={label} className="flex justify-between items-baseline">
                  <span className="text-[12px] text-[#2E2E2E]">{label}</span>
                  <span className="font-mono text-[10px] text-[#0A0A0A] tabular-nums">{val}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 7. Expandable details (AI insights + scientific basis) ── */}
      <div className="px-5 pt-5">
      <Accordion
        type="multiple"
        defaultValue={[]}
        className="space-y-px"
      >
        {/* AI Insights */}
        {version === 'pro' && (
          <AccordionItem value="ai-insights" className="border border-black/10 overflow-hidden">
            <AccordionTrigger className="hover:no-underline px-4 py-3 bg-white">
              <div className="flex items-center gap-3 text-left w-full">
                {loadingInsights && (
                  <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center" aria-hidden>
                    <span className="block w-3.5 h-3.5 rounded-full border-2 border-[#0A0A0A] border-t-transparent animate-spin" />
                  </span>
                )}
                <p className="font-display font-semibold text-[15px] uppercase tracking-wide text-[#0A0A0A]">
                  {t('result.aiInsights')}
                  {loadingInsights && (
                    <span className="font-mono text-[9px] font-normal text-[#8A9099] ml-2 animate-pulse">{t('result.analyzing')}</span>
                  )}
                </p>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              {loadingInsights && (
                <div className="space-y-3 animate-pulse py-2">
                  <div className="h-3 rounded bg-gray-100 w-full" />
                  <div className="h-3 rounded bg-gray-100 w-4/5" />
                  <div className="h-3 rounded bg-gray-100 w-full" />
                  <div className="h-3 rounded bg-gray-100 w-3/4" />
                </div>
              )}
              {!loadingInsights && !aiInsights && (
                <p className="text-[13px] text-gray-500 py-2">
                  Profile analysis is temporarily unavailable.
                  {profile.sweatRate === 'high' && profile.sweatSaltiness === 'high'
                    ? ' You are a high-volume sweater with elevated sodium loss — aggressive electrolyte replacement helps maintain performance.'
                    : profile.sweatRate === 'high'
                    ? ' Your high sweat rate means you lose more fluid than average — prioritize consistent hydration.'
                    : ' Your profile falls within typical ranges; standard protocols work well with environmental adjustments.'}
                </p>
              )}
              {aiInsights && !loadingInsights && (
                <div className="space-y-4 text-[13px] text-gray-600">
                  {aiInsights.personalized_insight && <p>{aiInsights.personalized_insight}</p>}

                  {/* Profile vs Average Athlete bars */}
                  <div className="space-y-3 pt-1">
                    {[
                      { label: 'Sweat Rate', value: profile.sweatRate },
                      { label: 'Sweat Sodium Loss', value: profile.sweatSaltiness },
                    ].map(({ label, value }) => (
                      <div key={label} className="space-y-1">
                        <div className="flex justify-between text-[12px]">
                          <span className="font-semibold text-[#0a0a0a]">{label}</span>
                          <span className="text-gray-400 capitalize">{value}</span>
                        </div>
                        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0a0a0a] transition-all duration-500"
                            style={{ width: value === 'high' ? '85%' : value === 'medium' ? '55%' : '25%' }}
                          />
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>Low</span>
                          <span>Average</span>
                          <span>High</span>
                        </div>
                      </div>
                    ))}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[12px]">
                        <span className="font-semibold text-[#0a0a0a]">Total Fluid Loss</span>
                        <span className="text-gray-400 font-mono">{safeNumber(plan.totalFluidLoss) ? Math.round(safeNumber(plan.totalFluidLoss)) : 'N/A'}ml</span>
                      </div>
                      <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#0a0a0a] transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, (safeNumber(plan.totalFluidLoss) / 4000) * 100))}%` }}
                        />
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-400">
                        <span>0ml</span>
                        <span>~2000ml avg</span>
                        <span>4000ml+</span>
                      </div>
                    </div>
                    {plan.energyGel && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[12px]">
                          <span className="font-semibold text-[#0a0a0a]">{t('result.energyGels')}</span>
                          <span className="text-gray-400 font-mono">
                            {plan.energyGel.applicable
                              ? `${plan.energyGel.totalGels} gel${plan.energyGel.totalGels !== 1 ? 's' : ''} · ${plan.energyGel.gelsPerHour}/hr`
                              : 'Not required'}
                          </span>
                        </div>
                        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#0a0a0a] transition-all duration-500"
                            style={{ width: plan.energyGel.applicable ? `${Math.min(100, Math.max(5, (plan.energyGel.totalGels / 8) * 100))}%` : '0%' }}
                          />
                          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>0</span>
                          <span>~4 avg</span>
                          <span>8+</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {aiInsights.risk_factors && (
                    <div className="border-l-2 border-gray-200 pl-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Risk factors</p>
                      <p>{aiInsights.risk_factors}</p>
                    </div>
                  )}
                  {aiInsights.optimization_tips && aiInsights.optimization_tips.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Tips</p>
                      <ul className="space-y-1">
                        {aiInsights.optimization_tips.map((tip, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-gray-300 shrink-0">&bull;</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {aiInsights.confidence_level && (
                    <p className="text-[11px] text-gray-400">
                      Confidence: {aiInsights.confidence_level}
                    </p>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Scientific Basis */}
        {(() => {
          const during = plan.duringActivity.totalElectrolytes;
          const pre = plan.preActivity.electrolytes;
          const post = safeNumber(plan.postActivity.electrolytes);
          const total = pre + during + post;
          const totalMg = total * 100;
          const effectiveDuration = Math.max(0, profile.sessionDuration - 0.5);
          const sachetsPerHr = effectiveDuration > 0 ? (during / effectiveDuration).toFixed(2) : '—';
          const schedule = computeDuringSachetSchedule(plan, profile, distanceKm);
          const sweatLabel = profile.sweatRate === 'high' ? 'high' : profile.sweatRate === 'low' ? 'low' : 'moderate';
          const saltLabel = profile.sweatSaltiness === 'high' ? 'high-sodium' : profile.sweatSaltiness === 'low' ? 'low-sodium' : 'typical';
          const mgOverLimit = totalMg > 350;
          return (
            <AccordionItem value="scientific-basis" className="border border-black/10 overflow-hidden">
              <AccordionTrigger className="hover:no-underline px-4 py-3 bg-white">
                <p className="font-display font-semibold text-[15px] uppercase tracking-wide text-[#0A0A0A]">{t('result.scientificBasis')}</p>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">

                {/* Why this many sachets */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Why {during} sachet{during !== 1 ? 's' : ''} during</p>
                  <p className="text-[12px] text-gray-600 leading-relaxed">
                    Your <span className="font-medium text-[#0a0a0a]">{sweatLabel} sweat rate</span> and <span className="font-medium text-[#0a0a0a]">{saltLabel} sweat</span> profile produce an estimated sodium loss that, combined with your {profile.weight ? `${profile.weight}kg body weight and ` : ''}race conditions, drives a requirement of ~{sachetsPerHr} sachets/hr.
                  </p>
                  <p className="text-[12px] text-gray-600 leading-relaxed">
                    ACSM guidelines for endurance athletes recommend <span className="font-medium text-[#0a0a0a]">300–600mg sodium/hr</span>. Each SUPPLME sachet provides 500mg Na. Applied across <span className="font-medium text-[#0a0a0a]">{effectiveDuration.toFixed(1)} hrs</span> of dosing window (race time minus last 30 min) = <span className="font-medium text-[#0a0a0a]">{during} sachet{during !== 1 ? 's' : ''}</span>.
                  </p>
                </div>

                {/* Timing rationale */}
                {schedule.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Timing</p>
                    <ul className="space-y-1">
                      {schedule.map((s, i) => (
                        <li key={i} className="text-[12px] text-gray-600 flex gap-2">
                          <span className="font-medium text-[#0a0a0a] shrink-0">{s.timeStr}{s.km > 0 ? ` / ${s.km} km` : ''}</span>
                          {i === 0 && <span>— after steady-state sweating begins (~15–20 min warm-up)</span>}
                          {i > 0 && <span>— minimum 20 min gap (GI absorption limit)</span>}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-gray-400">No sachet in the final 20 min — absorption window too short to benefit performance.</p>
                  </div>
                )}

                {/* Energy Gel rationale */}
                {plan.energyGel && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                      Why {plan.energyGel.applicable ? `${plan.energyGel.totalGels} energy gel${plan.energyGel.totalGels !== 1 ? 's' : ''}` : 'no energy gel required'}
                    </p>
                    <p className="text-[12px] text-gray-600 leading-relaxed">
                      {plan.energyGel.pubmedBasis}
                    </p>
                    {plan.energyGel.applicable && (
                      <p className="text-[12px] text-gray-600 leading-relaxed">
                        Total carbohydrate: <span className="font-medium text-[#0a0a0a]">{plan.energyGel.totalCarbsG}g</span> ({plan.energyGel.totalKcal} kcal). Each SUPPLME Liquid Energy Gel delivers 32g carbs in a 2:1 glucose:fructose ratio, utilising both SGLT1 and GLUT5 transporters for absorption up to ~90g CHO/hr.
                      </p>
                    )}
                  </div>
                )}

                {/* Safety check */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Safety check</p>
                  <div className="text-[12px] text-gray-600 space-y-0.5">
                    <p>Pre {pre} + during {during} + post {post} = <span className="font-medium text-[#0a0a0a]">{total} sachets total</span></p>
                    <p>Magnesium: {total} × 100mg = <span className="font-medium text-[#0a0a0a]">{totalMg}mg</span></p>
                    <p className={mgOverLimit ? 'text-amber-700' : 'text-gray-600'}>
                      NIH supplemental Mg limit: 350mg/day —{' '}
                      {mgOverLimit
                        ? `${totalMg - 350}mg over limit. This is offset by sweat Mg losses (~4mg/L × ${Math.round(plan.totalFluidLoss / 1000 * 10) / 10}L fluid loss = ~${Math.round(4 * plan.totalFluidLoss / 1000)}mg lost), but space sachets as planned.`
                        : `within limit`}
                    </p>
                  </div>
                </div>

                {/* References */}
                <div className="space-y-1 pt-1 border-t border-gray-100">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">References</p>
                  <ul className="space-y-1">
                    {[
                      'Sawka et al. ACSM Position Stand. Med Sci Sports Exerc. 2007;39(2):377–390',
                      'Thomas et al. Academy of Nutrition and Dietetics Position Paper. J Acad Nutr Diet. 2016',
                      'NIH Office of Dietary Supplements — Magnesium: Upper Tolerable Intake Level 350mg/day (supplemental)',
                      ...(plan.energyGel?.applicable ? [
                        'Jeukendrup AE. A step towards personalized sports nutrition: carbohydrate intake during exercise. Sports Med. 2014;44(S1):25–33. PMID 24791914',
                        'Burke LM et al. Carbohydrates for training and competition. J Sports Sci. 2011;29(S1):S17–27. PMID 21660838',
                      ] : []),
                    ].map((ref, i) => (
                      <li key={i} className="text-[11px] text-gray-400">{ref}</li>
                    ))}
                  </ul>
                </div>

              </AccordionContent>
            </AccordionItem>
          );
        })()}
      </Accordion>
      </div>{/* end accordion wrapper div */}

      {/* ── 8. Auth prompt ── */}
      {!user && (
        <div className="px-5 mt-5 border border-black/10 p-4 text-center">
          <p className="font-display font-semibold text-[15px] uppercase tracking-wide text-[#0A0A0A]">{t('auth.savePlan')}</p>
          <p className="font-mono text-[9px] text-[#8A9099] tracking-[1.2px] mt-1">{t('auth.savePlanDescription')}</p>
          <button
            onClick={() => {
              try {
                sessionStorage.setItem('supplme_pending_plan', JSON.stringify({ profileData: initialProfile, planData: initialPlan }));
              } catch { /* ignore */ }
              navigate('/login?returnTo=/&savePlan=true');
            }}
            className="mt-3 px-4 py-2 bg-[#0A0A0A] text-white font-mono text-[9px] tracking-[1.5px] uppercase"
          >
            {t('auth.goToAccount')}
          </button>
        </div>
      )}

      {user && (
        <p className="text-center font-mono text-[9px] text-[#8A9099] tracking-[1.2px] mt-5">{t('auth.planSaved')}</p>
      )}

      {/* Citations footer */}
      <div className="px-5 mt-6 font-mono text-[9px] tracking-[1.4px] text-[#8A9099] leading-[1.7]">
        Sawka 2007 · Jeukendrup 2014 · ACSM · Informed Sport certified
      </div>

      {/* Retake */}
      <div className="flex justify-center mt-5 pb-2">
        <button
          onClick={onFullReset ?? onReset}
          className="font-mono text-[9px] tracking-[1.5px] text-[#8A9099] hover:text-[#0A0A0A] transition-colors uppercase"
        >
          {t('result.retake')}
        </button>
      </div>

      <div className="px-5">
        <PlanFooter onDeleteData={handleDeleteMyData} onExportData={handleExportMyData} />
      </div>

      {/* ── Sticky mobile action bar — appears on scroll ── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white border-t border-black/10 transition-transform duration-200 ${
          showStickyBar ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center justify-around px-4 max-w-[540px] mx-auto" style={{ paddingBottom: 'env(safe-area-inset-bottom)', minHeight: '60px' }}>
          <button
            onClick={handleSaveImage}
            disabled={isSharing}
            className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] text-[#0A0A0A] disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            <span className="font-mono text-[9px] tracking-[1px] uppercase">{t('home.saveImage')}</span>
          </button>
          {user?.email && (
            <button
              onClick={handleEmailPlan}
              className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[48px] text-[#0A0A0A]"
            >
              <Mail className="w-5 h-5" />
              <span className="font-mono text-[9px] tracking-[1px] uppercase">{t('home.emailPlan')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
