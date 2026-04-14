import { useState, useEffect, useRef } from 'react';
import { HydrationPlan, HydrationProfile, AIEnhancedInsights, AIValidation, SUPPLME_ELECTROLYTE_SPEC } from '@/types/hydration';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplets, AlertCircle, Sparkles, ExternalLink, Calculator, BookOpen, Shield, RefreshCw, Loader2, Zap, Clock, TrendingUp, Flag, Activity, Target, Download } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import supplmeLogo from '@/assets/supplme-logo-sort.svg';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRace } from '@/contexts/RaceContext';
import { MetricCard } from '@/components/MetricCard';
import { generateFuelPlanImage } from '@/components/ShareCard';

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

// Helper function to safely display numeric values and prevent NaN
const safeNumber = (value: number | null | undefined, fallback: number = 0): number => {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return fallback;
  }
  return value;
};

export function HydrationPlanDisplay({ plan: initialPlan, profile: initialProfile, onReset, onFullReset, hasSmartWatchData = false, hasStrava = false, rawSmartWatchData, version }: HydrationPlanDisplayProps) {
  const { t } = useLanguage();
  const { selectedRace } = useRace();
  const [aiInsights, setAiInsights] = useState<AIEnhancedInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const profileAnalysisRef = useRef<HTMLDivElement>(null);
  
  // Helper function to format hours as hh:mm:ss
  const formatHoursAsTime = (hours: number): string => {
    const h = Math.floor(hours);
    const remainingMinutes = (hours - h) * 60;
    const m = Math.floor(remainingMinutes);
    const s = Math.round((remainingMinutes - m) * 60);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  
  // Helper to format decimal hours to readable duration
  const formatSegmentDuration = (hours: number): string => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) return `${m}min`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  };

  const [isSharing, setIsSharing] = useState(false);
  const [plan] = useState(initialPlan);
  const [profile] = useState(initialProfile);
  const { toast } = useToast();
  // Extract distance from raceDistance string
  const distance = (() => {
    if (initialProfile.raceDistance) {
      const raceText = initialProfile.raceDistance.toLowerCase();
      
      // Check for common race names first
      const raceDistances: { [key: string]: number } = {
        'half ironman': 113,
        'ironman 70.3': 113,
        '70.3': 113,
        'ironman': 226,
        'full ironman': 226,
        '140.6': 226,
        'olympic': 51.5,
        'sprint': 25.75,
        'half marathon': 21.1,
        'marathon': 42.2,
        'ultra': 50,
        '50k': 50,
        '100k': 100,
        '100 mile': 160,
        '10k': 10,
        '5k': 5,
        'century': 160,
        '100 miles': 160,
      };
      
      for (const [raceName, dist] of Object.entries(raceDistances)) {
        if (raceText.includes(raceName)) {
          return dist;
        }
      }
      
      const match = initialProfile.raceDistance.match(/(\d+\.?\d*)/);
      return match ? parseFloat(match[1]) : 5;
    }
    return 5;
  })();

  // Scroll Profile Analysis into view when loading so the spinner is visible
  useEffect(() => {
    if (!loadingInsights || version !== 'pro') return;
    const t = setTimeout(() => profileAnalysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return () => clearTimeout(t);
  }, [loadingInsights, version]);

  useEffect(() => {
    const minLoadingMs = 1500; // Ensure loading state is visible so users see spinner + "Analyzing…"
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
          if (msg.includes('not configured') || msg.includes('OPENAI_API_KEY') || msg.includes('GEMINI_API_KEY')) {
            console.error('[Profile Analysis] Fix: Set OPENAI_API_KEY (or GEMINI_API_KEY) in Supabase → Project Settings → Edge Functions → Secrets. See README.');
          }
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
    if (!confirm(t('result.deleteConfirm'))) {
      return;
    }

    try {
      const deletionToken = localStorage.getItem('hydration_deletion_token');
      
      if (!deletionToken) {
        toast({
          title: t('result.cannotDeleteTitle'),
          description: t('result.cannotDeleteDescription'),
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase.functions.invoke('delete-user-data', {
        body: { 
          confirmDelete: true,
          deletionToken: deletionToken
        }
      });

      if (error) throw error;

      // Clear deletion token from localStorage
      localStorage.removeItem('hydration_deletion_token');

      toast({
        title: t('gdpr.toastDeletedTitle'),
        description: t('gdpr.toastDeletedDescription'),
      });

      // Optionally redirect after deletion
      setTimeout(() => onReset(), 2000);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to delete data:', error);
      }
      toast({
        title: t('gdpr.toastDeletionFailedTitle'),
        description: t('gdpr.toastDeletionFailedDescription'),
        variant: "destructive"
      });
    }
  };

  const getConfidenceBadgeColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'low': return 'bg-red-500/10 text-red-700 border-red-500/20';
      default: return 'bg-muted';
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      toast({
        title: t('result.generatingImageTitle'),
        description: t('result.generatingImageDescription'),
      });

      const blob = await generateFuelPlanImage(plan, profile, distance, selectedRace);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `supplme-plan-${distance}km.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Image Saved!",
        description: "Your fuel plan has been saved to your device.",
      });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: t('result.shareFailedTitle'),
        description: t('result.shareFailedDescription'),
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };
      

  const courseProfileLabel = (profile: string | undefined) => {
    switch (profile) {
      case 'flat':
        return 'Flat';
      case 'rolling':
        return 'Rolling';
      case 'hilly':
        return 'Hilly';
      case 'mountainous':
        return 'Mountainous';
      case 'extreme':
        return 'Extreme';
      default:
        return profile || '';
    }
  };

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 px-3 sm:px-4 md:px-0 min-w-0">
      {/* Epic Header - Achievement Unlocked Style */}
      <div className="relative overflow-hidden">
        {/* Background Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-chrome-light/20 via-transparent to-chrome-light/20 blur-3xl" />
        {/* Accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" aria-hidden />
        
        <div className="relative text-center space-y-4 pt-4 pb-2">
          {/* Logo with Glow */}
          <div className="relative inline-block">
            <div className="absolute inset-0 glow-effect blur-3xl opacity-40"></div>
            <img src={supplmeLogo} alt="Supplme" className="h-28 sm:h-36 md:h-48 lg:h-56 mx-auto relative z-10 performance-pulse" />
          </div>
          
          {/* Main Title - Athletic Energy */}
          <div className="space-y-2 md:space-y-3">
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-7xl font-black tracking-tight uppercase text-foreground">
              YOUR ELITE PLAN
            </h1>
            <p className="text-base md:text-xl font-semibold text-muted-foreground max-w-2xl mx-auto px-4">
              Your Personalized Hydration Strategy
            </p>
          </div>
          
          {/* Enhanced badges: Strava + Smartwatch */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {hasStrava && (
              <div className="inline-flex items-center gap-2 athletic-card px-4 md:px-6 py-2 md:py-3 rounded-full bg-orange-500/10 border border-orange-500/30">
                <Activity className="w-4 h-4 md:w-5 md:h-5 text-orange-600 dark:text-orange-400" />
                <span className="text-xs md:text-sm font-bold tracking-wide uppercase text-foreground">
                  Enhanced with Strava
                </span>
              </div>
            )}
            {hasSmartWatchData && (
              <div className="inline-flex items-center gap-2 athletic-card px-4 md:px-6 py-2 md:py-3 rounded-full bg-chrome/10">
                <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-chrome-dark" />
                <span className="text-xs md:text-sm font-bold tracking-wide uppercase text-foreground">
                  Enhanced with Your Data
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Metrics Row — 4 key numbers */}
      {(() => {
        const totalSachets = plan.preActivity.electrolytes + plan.duringActivity.totalElectrolytes + plan.postActivity.electrolytes;
        const totalFluidMl = plan.preActivity.water + Math.round(safeNumber(plan.duringActivity.waterPerHour) * profile.sessionDuration) + plan.postActivity.water;
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <MetricCard
              icon={<Droplets className="w-5 h-5 text-blue-500" />}
              label="Total Fluid"
              value={(totalFluidMl / 1000).toFixed(1)}
              unit="L"
              sublabel="Pre + During + Post"
            />
            <MetricCard
              icon={<Zap className="w-5 h-5 text-primary" />}
              label="Sachets"
              value={totalSachets}
              sublabel={`${plan.preActivity.electrolytes} pre · ${plan.duringActivity.totalElectrolytes} during · ${plan.postActivity.electrolytes} post`}
              variant="highlight"
            />
            <MetricCard
              icon={<TrendingUp className="w-5 h-5 text-amber-500" />}
              label="Fluid needed / hour"
              value={safeNumber(plan.duringActivity.waterPerHour)}
              unit="ml"
              sublabel="During activity"
            />
            <MetricCard
              icon={<Clock className="w-5 h-5 text-green-500" />}
              label="Duration"
              value={formatHoursAsTime(profile.sessionDuration)}
              sublabel={profile.disciplines?.[0] || 'Activity'}
            />
          </div>
        );
      })()}

      {/* Safety Indicators */}
      {(() => {
        const warnings: { color: string; text: string }[] = [];
        const tempMax = profile.raceTempRange?.max ?? 20;
        if (tempMax >= 30) warnings.push({ color: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20', text: `🌡️ Extreme heat (${tempMax}°C) — increase fluid intake and monitor for heat illness` });
        else if (tempMax >= 25) warnings.push({ color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', text: `🌡️ Warm conditions (${tempMax}°C) — stay ahead of fluid losses` });
        if (profile.sessionDuration >= 4) warnings.push({ color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', text: '⏱️ Long-duration event — sodium losses accumulate; stick to sachet schedule' });
        if (profile.altitudeMeters > 1500) warnings.push({ color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20', text: `🏔️ Altitude (${profile.altitudeMeters}m) — increased respiratory water loss factored in` });
        if (plan.safetyFlags?.maxAmountApplied) warnings.push({ color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', text: '⚠️ Maximum safe intake limits applied — do not exceed recommended amounts' });
        if (warnings.length === 0) return null;
        return (
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div key={i} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium ${w.color}`}>
                {w.text}
              </div>
            ))}
          </div>
        );
      })()}

      {/* AI Validation Badge */}
      {(() => {
        const validation = aiInsights?.plan_validation as AIValidation | undefined;
        if (loadingInsights) return null; // Don't show anything while loading
        if (!validation) return null;
        return (
          <div className="space-y-2">
            {validation.status === 'approved' && validation.warnings.length === 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                <Shield className="w-4 h-4 flex-shrink-0" />
                Verified by AI — plan reviewed against sports science literature
              </div>
            )}
            {validation.warnings.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  AI review flagged {validation.warnings.length} concern{validation.warnings.length !== 1 ? 's' : ''}
                </div>
                {validation.warnings.map((warning, i) => (
                  <div key={i} className="flex items-start gap-2 px-4 py-2 rounded-lg border text-xs bg-amber-500/5 text-amber-700 dark:text-amber-400 border-amber-500/10">
                    <span className="mt-0.5 shrink-0">&#8226;</span>
                    <span>{warning}</span>
                  </div>
                ))}
              </>
            )}
            {validation.adjustments && validation.adjustments.length > 0 && (
              <div className="px-4 py-2.5 rounded-xl border text-xs bg-blue-500/5 text-blue-700 dark:text-blue-400 border-blue-500/10 space-y-1">
                <p className="font-medium">AI suggestions:</p>
                {validation.adjustments.map((adj, i) => (
                  <p key={i} className="pl-3">&#8226; {adj}</p>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Race Conditions Header + Map (only when a certified race is selected) */}
      {selectedRace && (
        <div className="space-y-4">
          <Card className="border border-primary/40 bg-primary/5 rounded-2xl">
            <div className="p-4 md:p-5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Race conditions
                  </p>
                  <h2 className="text-lg md:text-xl font-black tracking-tight text-foreground">
                    {selectedRace.name}
                  </h2>
                </div>
                {selectedRace.series && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide bg-background border border-primary/40 text-primary">
                    {selectedRace.series}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  <span aria-hidden>📍</span>
                  <span className="font-medium text-foreground">
                    {selectedRace.location}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  <span aria-hidden>🌡️</span>
                  <span>
                    {selectedRace.typical_temp_c.min}–{selectedRace.typical_temp_c.max}°C
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  <span aria-hidden>⛰️</span>
                  <span>{courseProfileLabel(selectedRace.course_profile)}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  <span aria-hidden>💧</span>
                  <span>{selectedRace.typical_humidity_pct}% humidity</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-muted text-muted-foreground">
                  <span aria-hidden>📏</span>
                  <span>
                    {selectedRace.distance_km % 1 === 0
                      ? `${selectedRace.distance_km.toFixed(0)} km`
                      : `${selectedRace.distance_km.toFixed(1)} km`}
                  </span>
                </span>
              </div>
            </div>
          </Card>

        </div>
      )}

      {/* Smartwatch Data Info Banner - Chrome Style */}
      {hasSmartWatchData && (
        <Alert className="athletic-card border-elite/30 bg-elite/5">
          <Sparkles className="h-5 w-5 text-elite" />
          <AlertTitle className="text-lg font-bold text-foreground">Performance Optimized with Your Metrics</AlertTitle>
          <AlertDescription className="text-base">
            This plan leverages your physiological data, sleep patterns, activity history, and recovery metrics for elite-level accuracy.
          </AlertDescription>
        </Alert>
      )}


      {/* Race Day Protocol - Only shows if user is training for a race */}
      {profile.hasUpcomingRace && (
        <div className="space-y-6 scroll-mt-6" id="race-day-protocol">
          {/* Header + quick-jump nav */}
          <div className="text-center py-6 md:py-8 space-y-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight uppercase text-foreground">
              Race Day Protocol
            </h2>
            <p className="text-base md:text-lg font-semibold text-muted-foreground">Your 48-hour performance strategy</p>
            <nav className="flex overflow-x-auto overflow-y-hidden flex-nowrap gap-1.5 sm:gap-2 pt-2 pb-1 -mx-2 px-2 justify-start sm:justify-center [scrollbar-width:thin]" aria-label="Jump to section">
              <a href="#race-day-before" className="text-xs font-bold uppercase tracking-wider px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] inline-flex items-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors whitespace-nowrap shrink-0 touch-manipulation">Day Before</a>
              <a href="#race-day-morning" className="text-xs font-bold uppercase tracking-wider px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] inline-flex items-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors whitespace-nowrap shrink-0 touch-manipulation">Race Morning</a>
              {!(profile.disciplines?.includes('Swimming')) && (
                <a href="#race-day-during" className="text-xs font-bold uppercase tracking-wider px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] inline-flex items-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors whitespace-nowrap shrink-0 touch-manipulation">During</a>
              )}
              <a href="#race-day-recovery" className="text-xs font-bold uppercase tracking-wider px-3 sm:px-4 py-2 sm:py-3 min-h-[44px] inline-flex items-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors whitespace-nowrap shrink-0 touch-manipulation">Recovery</a>
            </nav>
          </div>

          {/* Single-column scroll-friendly timeline */}
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* 1. Day Before */}
            <section id="race-day-before" className="scroll-mt-24 rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">1</span>
                <span className="text-2xl" aria-hidden>🗓️</span>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Day Before</h3>
                  <p className="text-xs font-semibold text-muted-foreground">T-24 hours</p>
                </div>
              </div>
              <div className="p-3 sm:p-4 md:p-5 space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="p-3 sm:p-4 rounded-xl bg-muted/50 border border-border">
                    <Droplets className="w-6 sm:w-7 h-6 sm:h-7 mb-2 text-foreground" />
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Hydrate</p>
                    <p className="text-lg sm:text-xl font-black metric-number">2–3L</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Throughout day</p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-xl bg-muted/50 border border-border">
                    <Zap className="w-6 sm:w-7 h-6 sm:h-7 mb-2 text-foreground" />
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">With dinner</p>
                    <p className="text-base sm:text-lg font-black metric-number">500ml + 2× Supplme</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">5–7pm for sleep</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border space-y-1">
                  <p className="text-xs font-medium text-foreground">When: Throughout the day; 5–7pm with dinner</p>
                  <p className="text-xs text-muted-foreground italic">Tip: Spread 2–3L across the day. Have 500ml + 2× Supplme with dinner (5–7pm) to support sleep. Avoid alcohol, new foods, and late caffeine.</p>
                </div>
              </div>
            </section>

            {/* 2. Race Morning */}
            <section id="race-day-morning" className="scroll-mt-24 rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">2</span>
                <span className="text-2xl" aria-hidden>🌅</span>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Race Morning</h3>
                  <p className="text-xs font-semibold text-muted-foreground">T-3 hours</p>
                </div>
              </div>
              <div className="p-4 md:p-5 space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border-l-4 border-primary">
                  <span className="text-lg font-black text-primary metric-number shrink-0">-3h</span>
                  <div>
                    <p className="text-sm font-bold">{plan.preActivity.water}ml + breakfast</p>
                    <p className="text-xs text-muted-foreground">Wake up hydration</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border-l-4 border-primary">
                  <span className="text-lg font-black text-primary metric-number shrink-0">-2h</span>
                  <div>
                    <p className="text-sm font-bold">{plan.preActivity.electrolytes}× Supplme + 300ml</p>
                    <p className="text-xs text-muted-foreground">Last substantial intake</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/10 border-l-4 border-primary">
                  <span className="text-lg font-black text-primary metric-number shrink-0">-30m</span>
                  <div>
                    <p className="text-sm font-bold">Small sips only (100–150ml)</p>
                    <p className="text-xs text-muted-foreground">Final bathroom break</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-border space-y-1">
                  <p className="text-xs font-medium text-foreground">When: -3h {plan.preActivity.water}ml + breakfast; -2h {plan.preActivity.electrolytes}× Supplme + 300ml; -30m small sips only</p>
                  <p className="text-xs text-muted-foreground italic">Tip: Drink the water with breakfast, then take your sachet(s) + 300ml at -2h. From -30m only small sips so you can empty your bladder before the start.</p>
                </div>
              </div>
            </section>

            {/* 3. During Race (hidden for swimming and standalone running which has its own section below) - dark card so all text stays readable */}
            {!(profile.disciplines?.includes('Swimming')) && !(profile.disciplines?.[0] === 'Running' && !plan.triathlonSegments) && (
            <section id="race-day-during" className="scroll-mt-24 rounded-2xl border-2 border-elite/50 bg-zinc-900 text-white overflow-hidden shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700 bg-zinc-800/80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elite text-sm font-black text-white">3</span>
                <Flag className="w-6 h-6 text-elite shrink-0" />
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">During Race</h3>
                  <p className="text-xs font-semibold text-zinc-400">Execute the plan</p>
                </div>
              </div>
              <div className="p-4 md:p-5 space-y-4">
                {plan.triathlonSegments ? (() => {
                  const seg = plan.triathlonSegments;
                  return (
                    <>
                      {/* Summary row */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Total fluid</p>
                          <p className="text-xl font-black metric-number text-white">{safeNumber(seg.totalFluid)}ml</p>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Total sachets</p>
                          <p className="text-xl font-black metric-number text-white">{safeNumber(seg.totalSachets)}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Race time</p>
                          <p className="text-xl font-black metric-number text-white">{formatSegmentDuration(seg.totalDuration)}</p>
                        </div>
                      </div>

                      {/* Vertical timeline */}
                      <div className="space-y-0">
                        {/* SWIM */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="h-8 w-auto px-2 rounded-full bg-zinc-600 flex items-center justify-center text-xs font-black text-white">SWIM</div>
                            <div className="w-px h-full bg-zinc-600/30" />
                          </div>
                          <div className="pb-4">
                            <p className="text-sm font-bold text-white">Swim — {seg.swim.distance}m</p>
                            <p className="text-xs text-zinc-400">No hydration possible</p>
                            <p className="text-xs text-zinc-500">{formatSegmentDuration(seg.swim.duration)}</p>
                          </div>
                        </div>

                        {/* T1 */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="h-8 w-auto px-2 rounded-full bg-elite flex items-center justify-center text-xs font-black text-white">T1</div>
                            <div className="w-px h-full bg-elite/30" />
                          </div>
                          <div className="pb-4">
                            <p className="text-sm font-bold text-white">Transition 1</p>
                            <p className="text-xs text-zinc-300">{seg.t1.sachets > 0 ? `${seg.t1.sachets} sachet${seg.t1.sachets !== 1 ? 's' : ''}` : 'No sachets'} + {safeNumber(seg.t1.fluid)}ml</p>
                            <p className="text-xs font-semibold text-elite">Critical — drink immediately</p>
                          </div>
                        </div>

                        {/* BIKE */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="h-8 w-auto px-2 rounded-full bg-elite flex items-center justify-center text-xs font-black text-white">BIKE</div>
                            <div className="w-px h-full bg-elite/30" />
                          </div>
                          <div className="pb-4">
                            <p className="text-sm font-bold text-white">Bike — {seg.bike.distance}km</p>
                            <p className="text-xs text-zinc-300">{seg.bike.sachets > 0 ? `${seg.bike.sachets} sachet${seg.bike.sachets !== 1 ? 's' : ''}` : 'No sachets'} + {safeNumber(seg.bike.fluid)}ml</p>
                            {seg.bike.sachets > 0 && (
                              <p className="text-xs text-zinc-400">1 every {Math.round((seg.bike.duration * 60) / seg.bike.sachets)} min</p>
                            )}
                          </div>
                        </div>

                        {/* T2 */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="h-8 w-auto px-2 rounded-full bg-elite/70 flex items-center justify-center text-xs font-black text-white">T2</div>
                            <div className="w-px h-full bg-elite/30" />
                          </div>
                          <div className="pb-4">
                            <p className="text-sm font-bold text-white">Transition 2</p>
                            <p className="text-xs text-zinc-300">{safeNumber(seg.t2.fluid)}ml</p>
                            <p className="text-xs text-zinc-400">Quick sip before the run</p>
                          </div>
                        </div>

                        {/* RUN */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="h-8 w-auto px-2 rounded-full bg-elite flex items-center justify-center text-xs font-black text-white">RUN</div>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">Run — {seg.run.distance}km</p>
                            <p className="text-xs text-zinc-300">{seg.run.sachets > 0 ? `${seg.run.sachets} sachet${seg.run.sachets !== 1 ? 's' : ''}` : 'No sachets'} + {safeNumber(seg.run.fluid)}ml</p>
                            {seg.run.sachets > 0 && (
                              <p className="text-xs text-zinc-400">1 every {Math.round((seg.run.duration * 60) / seg.run.sachets)} min</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Tip */}
                      <div className="pt-3 border-t border-zinc-700">
                        <p className="text-xs text-zinc-400 italic">Tip: Pre-load with 1 sachet before the start. You can't hydrate during the swim, so T1 is your first chance — drink immediately.</p>
                      </div>
                    </>
                  );
                })() : (
                  <>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="p-3 sm:p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Water per hour</p>
                        <p className="text-lg sm:text-2xl md:text-3xl font-black metric-number text-white">{safeNumber(plan.duringActivity.waterPerHour)}ml</p>
                        <p className="text-[10px] sm:text-xs text-zinc-300">Sip {plan.duringActivity.frequency.toLowerCase()}</p>
                      </div>
                      <div className="p-3 sm:p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                        <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Supplme total</p>
                        <p className="text-lg sm:text-2xl md:text-3xl font-black metric-number text-white">{plan.duringActivity.totalElectrolytes} sachet{plan.duringActivity.totalElectrolytes !== 1 ? 's' : ''}</p>
                        {plan.duringActivity.totalElectrolytes > 0 && (() => {
                          const totalMinutes = profile.sessionDuration * 60;
                          const minutesPerSachet = Math.round(totalMinutes / plan.duringActivity.totalElectrolytes);
                          const sodiumPerHour = Math.round(plan.duringActivity.electrolytesPerHour * SUPPLME_ELECTROLYTE_SPEC.sodium);
                          return (
                            <>
                              <p className="text-xs text-zinc-300">1 every {minutesPerSachet >= 60 ? formatHoursAsTime(minutesPerSachet / 60) : `${minutesPerSachet} min`}</p>
                              <p className="text-xs font-bold text-zinc-400 pt-1 border-t border-zinc-600">{sodiumPerHour}mg/h</p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="pt-3 border-t border-zinc-700 space-y-1">
                      <p className="text-xs font-medium text-zinc-300">When: Water — sip every 12–15 min. Sachets: {plan.duringActivity.totalElectrolytes > 0 && plan.duringActivity.electrolytesPerHour > 0
                        ? `1 every ${Math.round(60 / plan.duringActivity.electrolytesPerHour)} min`
                        : plan.duringActivity.totalElectrolytes > 0 ? 'Spread evenly across the race' : 'Not required'}.</p>
                      <p className="text-xs text-zinc-400 italic">Tip: Sip water steadily; take sachets at the suggested interval. Listen to your body and adjust if needed.</p>
                    </div>
                  </>
                )}
              </div>
            </section>
            )}

            {/* 3b. During Race — Running-specific sachet timeline (non-triathlon running only) */}
            {profile.disciplines?.[0] === 'Running' && !plan.triathlonSegments && !(profile.disciplines?.includes('Swimming')) && (
            <section id="race-day-during" className="scroll-mt-24 rounded-2xl border-2 border-elite/50 bg-zinc-900 text-white overflow-hidden shadow-xl">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700 bg-zinc-800/80">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-elite text-sm font-black text-white">3</span>
                <Flag className="w-6 h-6 text-elite shrink-0" />
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">During Race</h3>
                  <p className="text-xs font-semibold text-zinc-400">Your sachet schedule</p>
                </div>
              </div>
              <div className="p-3 sm:p-4 md:p-5 space-y-4">
                {/* Key numbers */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="p-3 sm:p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Water per hour</p>
                    <p className="text-lg sm:text-2xl md:text-3xl font-black metric-number text-white">{safeNumber(plan.duringActivity.waterPerHour)}ml</p>
                    <p className="text-[10px] sm:text-xs text-zinc-300">Sip every 10–15 min</p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                    <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Sachets during race</p>
                    <p className="text-lg sm:text-2xl md:text-3xl font-black metric-number text-white">{plan.duringActivity.totalElectrolytes}</p>
                    <p className="text-[10px] sm:text-xs text-zinc-300">{plan.duringActivity.electrolytesPerHour}/hr</p>
                  </div>
                </div>

                {/* Sachet-by-sachet timeline */}
                {plan.duringActivity.totalElectrolytes > 0 && (() => {
                  const total = plan.duringActivity.totalElectrolytes;
                  const totalMin = Math.round(profile.sessionDuration * 60);
                  const interval = total > 1 ? Math.round(totalMin / total) : totalMin;
                  const pacePerKm = distance > 0 ? totalMin / distance : 0;
                  const sachets = Array.from({ length: total }, (_, i) => {
                    const minuteMark = Math.round(interval * (i + 1));
                    const km = pacePerKm > 0 ? Math.round((minuteMark / pacePerKm) * 10) / 10 : 0;
                    return { number: i + 1, minute: Math.min(minuteMark, totalMin), km };
                  });
                  return (
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">When to take each sachet</p>
                      <div className="space-y-0">
                        {sachets.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 py-2 border-b border-zinc-700/50 last:border-0">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-elite text-xs font-black text-white">{s.number}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white">
                                Sachet #{s.number}
                              </p>
                              <p className="text-xs text-zinc-300">
                                At <strong className="text-white">{Math.floor(s.minute / 60) > 0 ? `${Math.floor(s.minute / 60)}h ${s.minute % 60}min` : `${s.minute} min`}</strong>
                                {s.km > 0 && <> — approx. <strong className="text-white">km {s.km}</strong></>}
                              </p>
                            </div>
                            <span className="text-xs text-zinc-500 shrink-0">+ water</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Water reminder */}
                <div className="p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50">
                  <p className="text-xs font-bold text-zinc-300 mb-1">Water between sachets</p>
                  <p className="text-xs text-zinc-400">
                    Sip {Math.round(safeNumber(plan.duringActivity.waterPerHour) / 4)}ml every ~15 min at aid stations. Don't gulp — small, consistent sips keep your stomach settled.
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-700 space-y-1">
                  <p className="text-xs text-zinc-400 italic">Tip: Set a repeating timer on your watch. Carry sachets in your race belt or shorts pocket for easy access between aid stations.</p>
                </div>
              </div>
            </section>
            )}

            {/* 4. Recovery */}
            <section id="race-day-recovery" className="scroll-mt-24 rounded-2xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">4</span>
                <Target className="w-6 h-6 text-primary shrink-0" />
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight">Recovery</h3>
                  <p className="text-xs font-semibold text-muted-foreground">4–6 hour window</p>
                </div>
              </div>
              <div className="p-4 md:p-5">
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-black text-primary-foreground">0h</div>
                      <div className="w-px h-8 bg-primary/30" />
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-bold">Immediate</p>
                      <p className="text-xs text-muted-foreground">500ml + {safeNumber(plan.postActivity.electrolytes)}× Supplme</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="h-8 w-8 rounded-full bg-primary/70 flex items-center justify-center text-xs font-black text-primary-foreground">2h</div>
                      <div className="w-px h-8 bg-primary/30" />
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-bold">First phase</p>
                      <p className="text-xs text-muted-foreground">{safeNumber(Math.round(plan.postActivity.water * 0.5))}ml + protein meal</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/40 flex items-center justify-center text-xs font-black text-primary-foreground shrink-0">6h</div>
                    <div>
                      <p className="text-sm font-bold">Complete</p>
                      <p className="text-xs text-muted-foreground">{safeNumber(plan.postActivity.water)}ml total (150% loss)</p>
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-border space-y-1">
                  <p className="text-xs font-medium text-foreground">When: {plan.postActivity.timing}</p>
                  <p className="text-xs text-muted-foreground italic">Tip: Have your sachet{safeNumber(plan.postActivity.electrolytes) !== 1 ? 's' : ''} with the recovery water over 4–6 hours. Aim for pale yellow urine by evening.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Race Day Hydration Guide (legacy – hidden when main Race Day Protocol is shown) */}
      {profile.upcomingEvents && !profile.hasUpcomingRace && (
        <div className="space-y-6">
          <div className="text-center py-4">
            <h2 className="text-2xl font-bold">Race Day Hydration Plan</h2>
            <p className="text-muted-foreground mt-2">
              For your upcoming: <strong>{profile.upcomingEvents}</strong>
            </p>
          </div>

          <Card className="p-6 bg-primary/5 border-primary/20">
            <h3 className="text-xl font-semibold mb-4">Race Day Strategy</h3>
            
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Race Adjustments</AlertTitle>
              <AlertDescription>
                Race intensity is typically 10-15% higher than training, increasing fluid needs. 
                Nervousness and adrenaline also increase fluid loss. Practice this strategy during training!
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="bg-background p-4 rounded-lg">
                <h4 className="font-semibold mb-3">Pre-Race Strategy</h4>
                <ul className="space-y-2 text-sm">
                  <li>• <strong>{plan.preActivity.timing}:</strong> {plan.preActivity.water}ml water + <strong>{plan.preActivity.electrolytes}x Supplme sachet</strong></li>
                  <li className="text-muted-foreground italic">Race-day bonus: Day before race, add {plan.preActivity.water}ml extra throughout the day to ensure full hydration stores</li>
                  <li className="text-muted-foreground italic">Optional: 30 min before start, take 200-300ml water in sips if comfortable (not included in main totals)</li>
                </ul>
              </div>

              <div className="bg-background p-4 rounded-lg">
                <h4 className="font-semibold mb-3">During Race - Supplme Sachet Schedule</h4>
                {profile.disciplines?.[0] === 'Triathlon' ? (
                  <div className="space-y-4">
                    <p className="text-sm font-bold text-primary">For Triathlon:</p>
                    <p className="text-xs text-muted-foreground p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <strong>You cannot take electrolyte sachets while swimming.</strong> Your {plan.duringActivity.totalElectrolytes} during-activity sachets are for <strong>bike and run only</strong> — the plan is calculated excluding swim time.
                    </p>
                    <div className="space-y-3">
                      <div className="border-l-4 border-blue-500 pl-3">
                        <p className="text-sm font-semibold">🏊 <strong>Swim Segment</strong></p>
                        <p className="text-sm text-muted-foreground mt-1">No sachets during the swim — not possible to consume in the water. Pre-load with 1 sachet 2 hours before the start to cover the swim.</p>
                        <p className="text-xs text-muted-foreground italic mt-1">Take all {plan.duringActivity.totalElectrolytes} during-activity sachets on the bike and run only.</p>
                      </div>
                      
                      <div className="border-l-4 border-green-500 pl-3">
                        <p className="text-sm font-semibold">🏃 <strong>T1 Transition (Swim → Bike)</strong></p>
                        <p className="text-sm text-muted-foreground mt-1">Take 1 Supplme sachet immediately in transition area</p>
                        <p className="text-xs text-muted-foreground italic mt-1">Mix with water or take straight - have it ready in transition bag</p>
                      </div>
                      
                      <div className="border-l-4 border-purple-500 pl-3">
                        <p className="text-sm font-semibold">🚴 <strong>Bike Segment</strong></p>
                        <p className="text-sm text-muted-foreground mt-1">1 sachet every 45-60 minutes{safeNumber(plan.duringActivity.waterPerHour) > 0 ? ` + ${Math.round(safeNumber(plan.duringActivity.waterPerHour) * 0.85)}ml water/hour` : ''}</p>
                        <p className="text-xs text-muted-foreground italic mt-1">Tip: Set timer on watch, keep sachets in jersey pocket or bento box</p>
                        <p className="text-xs text-muted-foreground italic mt-1">Sip water consistently throughout - don't gulp</p>
                      </div>
                      
                      <div className="border-l-4 border-green-500 pl-3">
                        <p className="text-sm font-semibold">🏃 <strong>T2 Transition (Bike → Run)</strong></p>
                        <p className="text-sm text-muted-foreground mt-1">Take 1 Supplme sachet as you enter T2 or immediately after mounting</p>
                        <p className="text-xs text-muted-foreground italic mt-1">Critical timing: Stomach needs to settle before run - take early in transition</p>
                      </div>
                      
                      <div className="border-l-4 border-orange-500 pl-3">
                        <p className="text-sm font-semibold">🏃 <strong>Run Segment</strong></p>
                        <p className="text-sm text-muted-foreground mt-1">1 sachet every 30-45 minutes at aid stations + water as tolerated</p>
                        <p className="text-xs text-muted-foreground italic mt-1">Aim for sachets at every 2nd-3rd aid station depending on spacing</p>
                        <p className="text-xs text-muted-foreground italic mt-1">Carry 1-2 backup sachets in race belt/pocket if aid stations are far apart</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <p className="text-sm font-semibold text-primary mb-2">💡 Pro Tip for Transitions:</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        <li>• Pre-open sachet caps slightly for quick access in T1/T2</li>
                        <li>• Place sachets in dedicated pockets of transition bags</li>
                        <li>• Practice your nutrition timing during training</li>
                        <li>• If feeling nauseated, prioritize the transition sachets</li>
                      </ul>
                    </div>
                  </div>
                ) : profile.disciplines?.[0] === 'Running' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <div className="p-2.5 sm:p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                        <p className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground">Water / hour</p>
                        <p className="text-lg sm:text-xl font-black">{safeNumber(plan.duringActivity.waterPerHour)}ml</p>
                        <p className="text-xs text-muted-foreground">~{Math.round(safeNumber(plan.duringActivity.waterPerHour) / 4)}ml every 15 min</p>
                      </div>
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                        <p className="text-xs font-bold uppercase text-muted-foreground">Sachets total</p>
                        <p className="text-xl font-black">{plan.duringActivity.totalElectrolytes}</p>
                        <p className="text-xs text-muted-foreground">{plan.duringActivity.electrolytesPerHour}/hr</p>
                      </div>
                    </div>
                    {plan.duringActivity.totalElectrolytes > 0 && (() => {
                      const total = plan.duringActivity.totalElectrolytes;
                      const totalMin = Math.round(profile.sessionDuration * 60);
                      const interval = total > 1 ? Math.round(totalMin / total) : totalMin;
                      const pacePerKm = distance > 0 ? totalMin / distance : 0;
                      const sachets = Array.from({ length: total }, (_, i) => {
                        const minuteMark = Math.round(interval * (i + 1));
                        const km = pacePerKm > 0 ? Math.round((minuteMark / pacePerKm) * 10) / 10 : 0;
                        return { number: i + 1, minute: Math.min(minuteMark, totalMin), km };
                      });
                      return (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold">When to take each sachet:</p>
                          {sachets.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">{s.number}</span>
                              <span>
                                <strong>Sachet #{s.number}</strong> at {Math.floor(s.minute / 60) > 0 ? `${Math.floor(s.minute / 60)}h ${s.minute % 60}min` : `${s.minute} min`}
                                {s.km > 0 && <span className="text-muted-foreground"> — ~km {s.km}</span>}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                    <p className="text-xs text-muted-foreground italic">Tip: Set a repeating timer on your watch. Take sachets at aid stations with water.</p>
                  </div>
                ) : profile.disciplines?.[0] === 'Bike' ? (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>{plan.duringActivity.frequency}:</strong> Supplme sachet</li>
                    {safeNumber(plan.duringActivity.waterPerHour) > 0 && (
                      <li>• Drink {safeNumber(plan.duringActivity.waterPerHour)}ml water per hour in small sips</li>
                    )}
                    <li>• Keep sachets in jersey pocket or bike bag for easy access</li>
                  </ul>
                ) : profile.disciplines?.[0] === 'Football' ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">For Football (Soccer):</p>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Pre-Match:</strong> {plan.preActivity.water}ml water + {plan.preActivity.electrolytes}x Supplme sachet ({plan.preActivity.timing})</li>
                      <li>• <strong>Half-Time:</strong> 1 Supplme sachet + {Math.round(safeNumber(plan.duringActivity.waterPerHour) / 2)}ml water</li>
                      <li>• <strong>Post-Match:</strong> {safeNumber(plan.postActivity.water)}ml water + {safeNumber(plan.postActivity.electrolytes)}x Supplme sachet ({plan.postActivity.timing})</li>
                    </ul>
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>{plan.duringActivity.frequency}:</strong> Supplme sachet</li>
                    {safeNumber(plan.duringActivity.waterPerHour) > 0 && (
                      <li>• Drink {safeNumber(plan.duringActivity.waterPerHour)}ml water per hour</li>
                    )}
                    <li>• Adjust based on aid station availability</li>
                  </ul>
                )}
              </div>

              <div className="bg-background p-4 rounded-lg">
                <h4 className="font-semibold mb-3">Post-Race Recovery</h4>
                <ul className="space-y-2 text-sm">
                  <li>• <strong>{plan.postActivity.timing}:</strong> {safeNumber(plan.postActivity.water)}ml water + <strong>{safeNumber(plan.postActivity.electrolytes)}x Supplme sachet(s)</strong></li>
                  <li>• Continue sipping water over next 2-4 hours until reaching total</li>
                  <li>• Monitor urine color - aim for pale yellow within 2-3 hours post-race</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 3. The Science Behind Your Sachet Dosing (collapsible) */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="science">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-3 text-left">
              <BookOpen className="h-5 w-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm md:text-base font-bold uppercase tracking-wide">
                  The Science Behind Your Sachet Dosing
                </p>
                <p className="text-xs text-muted-foreground">
                  Optional deep dive into why this plan works
                </p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
      {(() => {
        // Use known sodium loss if provided, else derive from sweat saltiness
        const fromSaltiness = {
          'low': 400, 'medium': 650, 'high': 1100,
        }[profile.sweatSaltiness] || 650;
        const sodiumLossPerHour = (profile.knownSodiumLossPerHour != null && profile.knownSodiumLossPerHour >= 200 && profile.knownSodiumLossPerHour <= 2000)
          ? Math.round(profile.knownSodiumLossPerHour)
          : fromSaltiness;
        
        const totalSodiumLoss = sodiumLossPerHour * profile.sessionDuration;
        const sachetsPerHour = plan.duringActivity.electrolytesPerHour || 1;
        const totalSachets = Math.round(sachetsPerHour * profile.sessionDuration) + plan.preActivity.electrolytes + plan.postActivity.electrolytes;
        
        return (
          <Card className="mt-3 p-4 md:p-6 bg-muted/20 border border-border">
            <h3 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
              The Science Behind Your Sachet Dosing
            </h3>
            <div className="space-y-4 text-sm text-muted-foreground">
              {/* Your numbers – one block */}
              <div>
                <p className="leading-relaxed">
                  With your <strong className="text-foreground">{profile.sweatSaltiness}</strong> sweat profile you lose about <strong className="text-foreground">{sodiumLossPerHour} mg sodium/hour</strong>. 
                  Over <strong className="text-foreground">{formatHoursAsTime(profile.sessionDuration)}</strong> that’s <strong className="text-foreground">~{Math.round(totalSodiumLoss)} mg total</strong>. 
                  Each sachet has {SUPPLME_ELECTROLYTE_SPEC.sodium} mg sodium, so we recommend <strong className="text-foreground">{sachetsPerHour} sachet{sachetsPerHour !== 1 ? 's' : ''}/hour</strong> during (adjusted for your weight, temp and sweat rate).
                </p>
              </div>
              {/* How it applies */}
              <div className="rounded-lg bg-background/60 border border-border p-3">
                {profile.sessionDuration < 2 ? (
                  <p className="leading-snug">
                    <strong className="text-foreground">Under 2h:</strong> Sodium needs are covered by <strong>{plan.preActivity.electrolytes} pre</strong> + <strong>{plan.postActivity.electrolytes} post</strong> sachets only (no during-activity sachets).
                  </p>
                ) : (
                  <p className="leading-snug">
                    <strong className="text-foreground">Your session:</strong> {sachetsPerHour} sachet{sachetsPerHour !== 1 ? 's' : ''}/hour during + pre & post = <strong className="text-foreground">{(plan.preActivity.electrolytes + plan.duringActivity.totalElectrolytes + plan.postActivity.electrolytes)} sachets</strong> total, covering ~{Math.round(totalSodiumLoss)} mg sodium loss.
                  </p>
                )}
              </div>
              {/* Pre / During / Post – one line each */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span><strong className="text-foreground">Pre:</strong> {plan.preActivity.electrolytes} sachet{plan.preActivity.electrolytes !== 1 ? 's' : ''} before (plasma pre-load)</span>
                <span><strong className="text-foreground">During:</strong> {plan.duringActivity.totalElectrolytes} total {profile.sessionDuration >= 2 ? `(${sachetsPerHour}/hr)` : '(not needed under 2h)'}</span>
                <span><strong className="text-foreground">Post:</strong> {plan.postActivity.electrolytes} sachet{plan.postActivity.electrolytes !== 1 ? 's' : ''} + {plan.postActivity.water} ml water (recovery)</span>
              </div>
              {/* Why it matters – one sentence */}
              <p className="text-xs italic border-t border-border pt-3">
                Sodium is the main electrolyte lost in sweat and drives fluid retention; replacing it helps avoid dehydration, cramping and pace drop-off.
              </p>
              {profile.sessionDuration >= 4 && (
                <p className="text-xs font-medium text-foreground">
                  ⚡ 4h+ sessions: stick to {sachetsPerHour} sachet{sachetsPerHour !== 1 ? 's' : ''}/hour to stay ahead of cumulative loss.
                </p>
              )}
              {/* References – compact */}
              <div className="pt-2 border-t border-border">
                <p className="text-[11px] text-muted-foreground">
                  Based on ACSM (2007), Baker et al. (2016), Goulet (2012), Sawka et al. (2015).{' '}
                  <a href="https://pubmed.ncbi.nlm.nih.gov/17277604/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PMID: 17277604</a>,{' '}
                  <a href="https://pubmed.ncbi.nlm.nih.gov/26070030/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">26070030</a>.
                </p>
              </div>
              {version === 'simple' && (
                <p className="text-xs text-primary font-medium pt-1">
                  💡 Want more precision? Use Pro and/or upload smartwatch data for tailored insights.
                </p>
              )}
            </div>
          </Card>
        );
      })()}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* 4. Your Profile Analysis (collapsible, same style as Science - Pro only) */}
      {version === 'pro' && (
        <div ref={profileAnalysisRef} className="scroll-mt-24">
        <Accordion type="single" collapsible className="w-full mt-4">
          <AccordionItem value="profile-analysis">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-3 text-left w-full">
                {loadingInsights ? (
                  <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center" aria-hidden>
                    <span className="block w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  </span>
                ) : (
                  <Sparkles className="h-5 w-5 text-primary flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm md:text-base font-bold uppercase tracking-wide flex items-center gap-2">
                    Your Profile Analysis
                    {loadingInsights && (
                      <span className="text-xs font-normal normal-case text-primary animate-pulse">
                        Analyzing…
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {loadingInsights ? 'Fetching AI insights…' : 'Your profile vs. average athlete & key insights'}
                  </p>
                </div>
                {loadingInsights && (
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-ping" aria-hidden />
                    <span className="block w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" aria-hidden />
                  </div>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {loadingInsights && (
                <Card className="border-0 shadow-lg bg-gradient-to-br from-muted/30 to-muted/10 mt-3 overflow-hidden">
                  <div className="p-6 md:p-8 space-y-5">
                    <div className="flex items-center justify-center gap-4">
                      <span className="flex-shrink-0 w-10 h-10 flex items-center justify-center" aria-hidden>
                        <span className="block w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      </span>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-foreground">Analyzing your profile</p>
                        <p className="text-xs text-muted-foreground">AI is generating personalized insights…</p>
                      </div>
                    </div>
                    <div className="space-y-3 animate-pulse">
                      <div className="h-3 rounded bg-muted/80 w-full" />
                      <div className="h-3 rounded bg-muted/80 w-4/5" />
                      <div className="h-3 rounded bg-muted/80 w-full" />
                      <div className="h-3 rounded bg-muted/80 w-3/4" />
                      <div className="h-8 rounded bg-muted/60 w-full mt-4" />
                      <div className="h-8 rounded bg-muted/60 w-full" />
                      <div className="h-8 rounded bg-muted/60 w-5/6" />
                    </div>
                  </div>
                </Card>
              )}
              {!loadingInsights && !aiInsights && (
                <Card className="mt-3 border-0 shadow-lg bg-gradient-to-br from-card to-muted/20 overflow-hidden">
                  <div className="p-6 md:p-8 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Profile analysis is temporarily unavailable. Here is your profile summary:
                    </p>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Activity className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-bold">Your Profile vs. Average Athlete</h3>
                      </div>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="font-semibold text-foreground">Sweat rate</span>
                          <span className="text-muted-foreground capitalize">{profile.sweatRate}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-semibold text-foreground">Sweat saltiness</span>
                          <span className="text-muted-foreground capitalize">{profile.sweatSaltiness}</span>
                        </div>
                        <p className="text-muted-foreground pt-2">
                          {profile.sweatRate === 'high' && profile.sweatSaltiness === 'high'
                            ? `You're a high-volume sweater with elevated sodium loss. Aggressive electrolyte replacement helps maintain performance and prevent cramping.`
                            : profile.sweatRate === 'high'
                            ? `Your high sweat rate means you lose more fluid than average—prioritize consistent hydration.`
                            : profile.sweatSaltiness === 'high'
                            ? `Your sweat has higher sodium concentration; electrolyte replacement is important to reduce cramping risk.`
                            : `Your profile falls within typical ranges; standard protocols work well with environmental adjustments.`}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              {aiInsights && !loadingInsights && (
                <Card className="mt-3 border-0 shadow-2xl bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 sm:w-96 h-48 sm:h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
                  <div className="relative p-3 sm:p-6 md:p-8 lg:p-10 space-y-4 sm:space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center shadow-lg">
                          <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-muted-foreground uppercase tracking-wide">Your Profile Analysis</h3>
                          {hasSmartWatchData && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                              <span className="text-xs font-medium text-primary">AI-Enhanced</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {aiInsights?.confidence_level && (
                        <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${getConfidenceBadgeColor(aiInsights.confidence_level)}`}>
                          {aiInsights.confidence_level.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {aiInsights.personalized_insight || (profile.sweatRate === 'high' && profile.sweatSaltiness === 'high'
                        ? `You're a high-volume sweater with elevated sodium loss. This requires aggressive electrolyte replacement to maintain performance and prevent cramping.`
                        : profile.sweatRate === 'high'
                        ? `Your high sweat rate means you lose significantly more fluid than average athletes during exercise.`
                        : profile.sweatSaltiness === 'high'
                        ? `Your sweat contains higher sodium concentrations than average, increasing your risk for cramping without proper electrolyte replacement.`
                        : `Your hydration profile falls within typical ranges for endurance athletes—standard protocols work well with environmental adjustments.`)}
                    </p>
                    {aiInsights.performance_comparison && (
                      <p className="text-sm text-muted-foreground leading-relaxed border-l-4 border-primary/30 pl-4">
                        {aiInsights.performance_comparison}
                      </p>
                    )}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                          <Activity className="w-5 h-5 text-primary" />
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold">Your Profile vs. Average Athlete</h3>
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-foreground">Sweat Rate</span>
                            <span className="text-muted-foreground capitalize font-medium">{profile.sweatRate}</span>
                          </div>
                          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                profile.sweatRate === 'high' ? 'bg-gradient-to-r from-amber-500 to-red-500 w-[85%]' :
                                profile.sweatRate === 'medium' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 w-[55%]' :
                                'bg-gradient-to-r from-green-500 to-emerald-500 w-[30%]'
                              }`}
                            />
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-foreground/30" />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Low</span>
                            <span className="font-medium">Average</span>
                            <span>High</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-foreground">Sweat Sodium Loss</span>
                            <span className="text-muted-foreground capitalize font-medium">{profile.sweatSaltiness}</span>
                          </div>
                          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                profile.sweatSaltiness === 'high' ? 'bg-gradient-to-r from-amber-500 to-red-500 w-[85%]' :
                                profile.sweatSaltiness === 'medium' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 w-[55%]' :
                                'bg-gradient-to-r from-green-500 to-emerald-500 w-[30%]'
                              }`}
                            />
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-foreground/30" />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Low</span>
                            <span className="font-medium">Average</span>
                            <span>High</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-foreground">Total Fluid Loss</span>
                            <span className="text-muted-foreground font-mono font-medium">
                              {safeNumber(plan.totalFluidLoss) ? Math.round(safeNumber(plan.totalFluidLoss)) : 'N/A'}ml
                            </span>
                          </div>
                          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                            {(() => {
                              const hourlyRate = plan.totalFluidLoss / profile.sessionDuration;
                              const barWidth = hourlyRate < 600 ? '30%' : hourlyRate < 800 ? '50%' : hourlyRate < 1000 ? '65%' : '85%';
                              const barColor = hourlyRate < 600 ? 'bg-gradient-to-r from-green-500 to-emerald-500' : hourlyRate < 1000 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gradient-to-r from-amber-500 to-red-500';
                              return <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: barWidth }} />;
                            })()}
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-foreground/30" />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Low</span>
                            <span className="font-medium">Average</span>
                            <span>High</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-foreground">Electrolyte Replacement Needs</span>
                            <span className="text-muted-foreground font-medium">{plan.duringActivity.electrolytesPerHour} sachets/hr</span>
                          </div>
                          <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                plan.duringActivity.electrolytesPerHour >= 2 ? 'bg-gradient-to-r from-amber-500 to-red-500 w-[80%]' :
                                plan.duringActivity.electrolytesPerHour >= 1.5 ? 'bg-gradient-to-r from-blue-500 to-cyan-500 w-[55%]' :
                                'bg-gradient-to-r from-green-500 to-emerald-500 w-[30%]'
                              }`}
                            />
                            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-foreground/30" />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Low (1/hr)</span>
                            <span className="font-medium">Average (1.5/hr)</span>
                            <span>High (2+/hr)</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border/50">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {safeNumber(plan.totalFluidLoss) && profile.sessionDuration ? (
                            profile.sweatRate === 'high' && profile.sweatSaltiness === 'high'
                              ? `⚡ You lose significantly more sodium and fluid than the average athlete. Your estimated ${Math.round(safeNumber(plan.totalFluidLoss))}ml total fluid loss, combined with elevated sweat sodium, requires aggressive electrolyte replacement throughout your ${formatHoursAsTime(profile.sessionDuration)} session.`
                              : profile.sweatRate === 'high'
                              ? `⚡ Your elevated sweat rate means you'll lose approximately ${Math.round(safeNumber(plan.totalFluidLoss))}ml during this ${formatHoursAsTime(profile.sessionDuration)} session. Consume ${safeNumber(plan.duringActivity.waterPerHour)}ml/hr with electrolytes ${plan.duringActivity.frequency.toLowerCase()} to maintain performance.`
                              : profile.sweatSaltiness === 'high'
                              ? `⚡ Your sweat has elevated sodium concentration, increasing cramping risk. The ${safeNumber(plan.duringActivity.electrolytesPerHour)} Supplme sachets/hr provide precise electrolyte ratios to maintain neuromuscular function.`
                              : `✓ Your balanced profile allows standard evidence-based protocols. Your ${Math.round(safeNumber(plan.totalFluidLoss))}ml total fluid loss over ${formatHoursAsTime(profile.sessionDuration)} is within the normal range for endurance athletes.`
                          ) : (
                            `Provide a session duration or distance to see personalized fluid loss and recommendations.`
                          )}
                          {profile.altitudeMeters > 1000 && (
                            <span className="block mt-2 font-medium text-foreground">
                              🏔️ Training at {profile.altitudeMeters}m altitude increases respiratory water loss—factored into your plan.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        </div>
      )}

      {/* Save to Device + Share */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Button
          onClick={handleShare}
          disabled={isSharing}
          size="lg"
          className="gap-2 min-h-[48px] w-full sm:w-auto touch-manipulation"
        >
          {isSharing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isSharing ? 'Generating...' : 'Save to Device'}
        </Button>
      </div>



      {/* Calculation Transparency (hidden for cleaner UI) */}
      {false && (
      <Card className="p-6">
        <Accordion type="single" collapsible>
          <AccordionItem value="calculations">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                <span className="font-semibold">How We Calculated Your Plan</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {hasSmartWatchData && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                      Enhanced Calculation Using Your Smartwatch Data
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      This plan uses your actual physiological metrics, training history, and recovery data for improved accuracy.
                    </p>
                  </div>
                )}
                {!hasSmartWatchData && (
                  <div className="bg-muted/50 border border-border rounded-lg p-3 mb-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      Standard Calculation Method
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on your responses and scientific research. Upload smartwatch data for more personalized results.
                    </p>
                  </div>
                )}
                {plan.calculationSteps.map((step, index) => (
                  <div key={index} className="flex gap-3 text-sm">
                    <span className="text-primary font-mono">{index + 1}.</span>
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>
      )}

      {/* Scientific References (hidden for cleaner UI) */}
      {false && (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Scientific References</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          All hydration recommendations are based on peer reviewed scientific research from PubMed, 
          the leading database of biomedical literature. Our calculations use evidence based guidelines 
          from sports science, exercise physiology, and nutrition research.
        </p>
      </Card>
      )}

      {/* Supplme product card + Retake */}
      <Card className="p-6 border border-border bg-card">
        <div className="flex flex-col items-center gap-4">
          <h4 className="font-semibold text-lg text-foreground">
            {t('result.supplmeTitle')}
          </h4>
          <p className="text-sm text-muted-foreground text-center">
            {t('result.supplmeSpec')
              .replace('{sodium}', String(SUPPLME_ELECTROLYTE_SPEC.sodium))
              .replace('{potassium}', String(SUPPLME_ELECTROLYTE_SPEC.potassium))
              .replace('{magnesium}', String(SUPPLME_ELECTROLYTE_SPEC.magnesium))
              .replace('{citrate}', String(SUPPLME_ELECTROLYTE_SPEC.citrate))
              .replace('{chloride}', String(SUPPLME_ELECTROLYTE_SPEC.chloride))}
          </p>
          <p className="text-sm text-muted-foreground text-center">
            {t('result.supplmeNoMixing')}
          </p>
          <Button variant="default" size="lg" asChild className="w-full sm:w-auto min-h-[48px] min-w-[44px] touch-manipulation">
            <a href="https://www.supplme.com/products/electrolyte-28-pack-clementine-salt" target="_blank" rel="noopener noreferrer">
              {t('result.buySupplme')}
            </a>
          </Button>
        </div>
      </Card>

      <div className="flex justify-center">
        <Button onClick={onFullReset ?? onReset} variant="outline" size="lg" className="gap-2 min-h-[48px] min-w-[44px] touch-manipulation">
          <RefreshCw className="w-4 h-4" />
          {t('result.retake')}
        </Button>
      </div>

      {/* GDPR Data Deletion */}
      <div className="flex justify-center pt-4">
        <Button 
          onClick={handleDeleteMyData} 
          variant="ghost" 
          size="sm" 
          className="text-muted-foreground hover:text-destructive text-xs min-h-[44px] min-w-[44px] touch-manipulation"
          aria-label={t('gdpr.deleteButton')}
        >
          {t('gdpr.deleteButton')}
        </Button>
      </div>

      {/* Medical Disclaimer - Moved to bottom */}
      <Alert>
        <Shield className="h-4 w-4 flex-shrink-0" />
        <AlertTitle>{t('disclaimer.medicalTitle')}</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            This hydration plan is generated using AI and scientific research for educational and informational purposes only. 
            It is <strong>not a substitute for professional medical advice, diagnosis, or treatment</strong>.
          </p>
          <p>
            Individual hydration needs vary significantly based on genetics, acclimatization, health conditions, and other factors. 
            Always consult with a qualified sports nutritionist, physician, or healthcare provider before making changes to your hydration strategy, 
            especially if you have medical conditions or take medications.
          </p>
          <p>
            For the most accurate personalized recommendations, consider professional sweat testing and consultation with a sports dietitian.
          </p>
        </AlertDescription>
      </Alert>

      {/* Legal Disclaimer */}
      <Card className="p-6 bg-muted/30 border-dashed">
        <div className="space-y-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">{t('disclaimer.legalTitle').toUpperCase()}</p>
          <p>
            Supplme and its affiliates make no guarantees, warranties, or representations regarding the accuracy, completeness, 
            or efficacy of this hydration plan. Results may vary, and performance improvements are not guaranteed.
          </p>
          <p>
            By using this tool, you acknowledge that Supplme shall not be held liable for any injuries, health issues, 
            performance outcomes, or other consequences resulting from following these recommendations. You assume all risks 
            associated with implementing this hydration strategy.
          </p>
          <p>
            This tool uses artificial intelligence which may produce errors or inaccuracies. All recommendations should be 
            verified with qualified professionals before implementation.
          </p>
          <p>
            Supplme products are dietary supplements and have not been evaluated by the FDA. These products are not intended 
            to diagnose, treat, cure, or prevent any disease.
          </p>
          <p className="pt-2 text-center">
            © 2025 Supplme. All rights reserved. Use of this tool constitutes acceptance of these terms.
          </p>
        </div>
      </Card>
    </div>
  );
}
