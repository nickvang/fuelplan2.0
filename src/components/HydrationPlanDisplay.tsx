import { useState, useEffect, useRef } from 'react';
import { HydrationPlan, HydrationProfile, AIEnhancedInsights } from '@/types/hydration';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRace } from '@/contexts/RaceContext';
import { generateFuelPlanImage } from '@/components/ShareCard';
import supplmeLogo from '@/assets/supplme-logo-sort.svg';

import { parseDistanceKm, safeNumber } from '@/components/plan/planHelpers';
import { PlanHeroSection } from '@/components/plan/PlanHeroSection';
import { SachetSummaryCard } from '@/components/plan/SachetSummaryCard';
import { TimelineSection } from '@/components/plan/TimelineSection';
import { ProductCTA } from '@/components/plan/ProductCTA';
import { PlanActionButtons } from '@/components/plan/PlanActionButtons';
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
  const { t } = useLanguage();
  const { selectedRace } = useRace();
  const { toast } = useToast();

  const [plan] = useState(initialPlan);
  const [profile] = useState(initialProfile);
  const [aiInsights, setAiInsights] = useState<AIEnhancedInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const profileAnalysisRef = useRef<HTMLDivElement>(null);

  const distanceKm = parseDistanceKm(profile.raceDistance);
  const isTriathlon = profile.disciplines?.[0] === 'Triathlon' && !!plan.triathlonSegments;
  const isSwimming = profile.disciplines?.includes('Swimming') && !isTriathlon;

  // Scroll Profile Analysis into view when loading
  useEffect(() => {
    if (!loadingInsights || version !== 'pro') return;
    const t = setTimeout(() => profileAnalysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    return () => clearTimeout(t);
  }, [loadingInsights, version]);

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

  const handleShare = async () => {
    setIsSharing(true);
    try {
      toast({ title: t('result.generatingImageTitle'), description: t('result.generatingImageDescription') });
      const blob = await generateFuelPlanImage(plan, profile, distanceKm, selectedRace);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `supplme-plan-${distanceKm}km.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Image Saved!", description: "Your fuel plan has been saved to your device." });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({ title: t('result.shareFailedTitle'), description: t('result.shareFailedDescription'), variant: "destructive" });
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="max-w-[540px] mx-auto px-5 py-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex justify-center">
        <img src={supplmeLogo} alt="Supplme" className="h-32 sm:h-40" />
      </div>

      <PlanHeroSection
        plan={plan}
        profile={profile}
        distanceKm={distanceKm}
        hasStrava={hasStrava}
        selectedRace={selectedRace}
      />

      <SachetSummaryCard
        plan={plan}
        distanceKm={distanceKm}
        sessionDuration={profile.sessionDuration}
      />

      <TimelineSection
        plan={plan}
        profile={profile}
        distanceKm={distanceKm}
        isSwimming={!!isSwimming}
        isTriathlon={isTriathlon}
      />

      {/* Profile Analysis — Pro only */}
      {version === 'pro' && (
        <div ref={profileAnalysisRef}>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="profile-analysis" className="border border-gray-200 rounded-lg overflow-hidden">
              <AccordionTrigger className="hover:no-underline px-3.5 py-3">
                <div className="flex items-center gap-3 text-left w-full">
                  {loadingInsights ? (
                    <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center" aria-hidden>
                      <span className="block w-4 h-4 rounded-full border-2 border-[#0a0a0a] border-t-transparent animate-spin" />
                    </span>
                  ) : (
                    <span className="text-[13px]">+</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-[#0a0a0a]">
                      Profile Analysis
                      {loadingInsights && (
                        <span className="text-[11px] font-normal text-gray-400 ml-2 animate-pulse">Analyzing...</span>
                      )}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3.5 pb-3.5">
                {loadingInsights && (
                  <div className="space-y-3 animate-pulse py-4">
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
                  <div className="space-y-3 text-[13px] text-gray-600">
                    {aiInsights.personalized_insight && <p>{aiInsights.personalized_insight}</p>}
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
          </Accordion>
        </div>
      )}

      <ProductCTA />

      <PlanActionButtons
        onSave={handleShare}
        isSaving={isSharing}
      />

      {/* Post-Session Feedback — hidden for now */}

      {/* Retake button */}
      <div className="flex justify-center">
        <button
          onClick={onFullReset ?? onReset}
          className="text-[13px] font-semibold text-gray-500 hover:text-[#0a0a0a] transition-colors underline"
        >
          {t('result.retake')}
        </button>
      </div>

      <PlanFooter onDeleteData={handleDeleteMyData} />
    </div>
  );
}
