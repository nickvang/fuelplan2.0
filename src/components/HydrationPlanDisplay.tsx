import { useState, useEffect, useRef } from 'react';
import { HydrationPlan, HydrationProfile, AIEnhancedInsights, SUPPLME_ELECTROLYTE_SPEC } from '@/types/hydration';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplets, AlertCircle, Sparkles, ExternalLink, Calculator, BookOpen, Shield, RefreshCw, Share2, Loader2, Zap, Clock, TrendingUp, Flag, Activity, Target } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { FullHydrationPlanProtocol } from '@/components/FullHydrationPlanProtocol';
import supplmeLogo from '@/assets/SUPPLME(r)hvid.svg';
import domtoimage from 'dom-to-image-more';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRace } from '@/contexts/RaceContext';

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

  const downloadPDF = () => {
    try {
      // Use browser print dialog so users can "Save as PDF" with full on-screen layout
      window.print();
    } catch (error) {
      console.error('Print Error:', error);
      toast({
        title: "Print Failed",
        description: "Your browser could not open the print dialog.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const element = document.getElementById('share-protocol-section');
      if (!element) {
        throw new Error('Protocol section not found');
      }

      toast({
        title: t('result.generatingImageTitle'),
        description: t('result.generatingImageDescription'),
      });

      const blob = await domtoimage.toBlob(element, {
        width: 1200,
        height: 1400,
        bgcolor: '#ffffff',
        quality: 1,
        scale: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: '1200px',
          height: '1400px'
        }
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `performance-protocol-${distance}km.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Image Saved!",
        description: "Your protocol image is ready to share on Instagram, WhatsApp, or SMS!",
      });
    } catch (error) {
      console.error('Share error:', error);
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
        {/* Background Glow Effect - subtle brand tint */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-red/5 via-transparent to-brand-green/5 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-br from-chrome-light/20 via-transparent to-chrome-light/20 blur-3xl" />
        {/* Accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-red/80 via-primary to-brand-green/80" aria-hidden />
        
        <div className="relative text-center space-y-4 pt-4 pb-2">
          {/* Logo with Glow */}
          <div className="relative inline-block">
            <div className="absolute inset-0 glow-effect blur-3xl opacity-40"></div>
            <img src={supplmeLogo} alt="Supplme" className="h-32 md:h-48 lg:h-56 mx-auto relative z-10 performance-pulse" />
          </div>
          
          {/* Main Title - Athletic Energy */}
          <div className="space-y-2 md:space-y-3">
            <h1 className="text-3xl md:text-5xl lg:text-7xl font-black tracking-tight uppercase text-foreground">
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
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
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

          <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="p-3 md:p-4 border-b border-border/60">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Race Location
              </p>
              <p className="text-sm font-medium text-foreground">
                {selectedRace.location}
              </p>
            </div>
            <div className="h-[260px] sm:h-[300px]">
              <iframe
                title={`Race location map for ${selectedRace.name}`}
                src={`https://maps.google.com/maps?q=${selectedRace.lat},${selectedRace.lng}&z=11&output=embed`}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
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

      {/* Full hydration plan – compact Race Day hidden here (expanded section below) */}
      <FullHydrationPlanProtocol plan={plan} profile={profile} variant="user" hideCompactRaceDay />

      {/* Hidden Export Version - Fixed size for image generation */}
      <div 
        id="share-protocol-section" 
        style={{ 
          position: 'fixed',
          left: '-9999px',
          top: '0',
          width: '1200px',
          height: '1400px',
          background: '#ffffff',
          padding: '60px',
          boxSizing: 'border-box',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        {/* Header - ultra clean, no boxes */}
        <div style={{ 
          padding: '20px 0 40px 0',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ 
              color: '#000000',
              fontSize: '52px',
              fontWeight: '900',
              margin: '0',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              lineHeight: '1.1'
            }}>
              YOUR PERFORMANCE PROTOCOL
            </h1>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <p style={{
              color: '#000000',
              fontSize: '64px',
              fontWeight: '900',
              margin: '0'
            }}>
              {distance} KM
            </p>
          </div>
          <div>
            <p style={{
              color: '#000000',
              fontSize: '24px',
              fontWeight: '700',
              margin: '0',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              opacity: '0.9'
            }}>
              {formatHoursAsTime(profile.sessionDuration)} {profile.disciplines?.[0] || 'Activity'} Session
            </p>
          </div>
        </div>

        {/* Three Columns - clean cards, no inner boxes */}
        <div style={{ display: 'flex', gap: '30px' }}>
          {/* PRE */}
          <div style={{ flex: '1', background: '#ffffff', padding: '20px 0' }}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ 
                fontSize: '13px', 
                fontWeight: '700', 
                color: '#888888', 
                margin: '0 0 6px 0',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                2-4 HOURS BEFORE
              </p>
              <h2 style={{ 
                fontSize: '40px', 
                fontWeight: '900', 
                color: '#000000', 
                margin: '0',
                lineHeight: '1.1'
              }}>
                PRE
              </h2>
            </div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#888888', margin: '0 0 4px 0', textTransform: 'uppercase' }}>WATER</p>
            <p style={{ fontSize: '32px', fontWeight: '900', color: '#000000', margin: '0 0 4px 0' }}>{plan.preActivity.water} ml</p>
            <p style={{ fontSize: '13px', fontWeight: '500', color: '#666666', margin: '0 0 16px 0' }}>Drink 2 hours before</p>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#888888', margin: '0 0 4px 0', textTransform: 'uppercase' }}>SUPPLME SACHET (30ML)</p>
            <p style={{ fontSize: '32px', fontWeight: '900', color: '#000000', margin: '0 0 12px 0' }}>{plan.preActivity.electrolytes}x</p>
            <p style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              color: '#666666', 
              margin: '16px 0 0 0',
              lineHeight: '1.4'
            }}>
              ⚡ Prime your body with optimal fluid balance before you start
            </p>
          </div>

          {/* DURING */}
          {!(profile.disciplines?.includes('Swimming') && profile.hasUpcomingRace) && (
          <div style={{ flex: '1', background: '#ffffff', padding: '20px 0' }}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ 
                fontSize: '13px', 
                fontWeight: '700', 
                color: '#888888', 
                margin: '0 0 6px 0',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                EVERY 12-15 MINUTES
              </p>
              <h2 style={{ 
                fontSize: '40px', 
                fontWeight: '900', 
                color: '#000000', 
                margin: '0',
                lineHeight: '1.1'
              }}>
                DURING
              </h2>
            </div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#888888', margin: '0 0 4px 0', textTransform: 'uppercase' }}>TOTAL WATER</p>
            <p style={{ fontSize: '32px', fontWeight: '900', color: '#000000', margin: '0 0 4px 0' }}>
              {safeNumber(plan.duringActivity.waterPerHour) > 0 
                ? `${Math.round(safeNumber(plan.duringActivity.waterPerHour) * profile.sessionDuration)} ml` 
                : 'As needed'}
            </p>
            {safeNumber(plan.duringActivity.waterPerHour) > 0 && (
              <p style={{ fontSize: '13px', fontWeight: '500', color: '#666666', margin: '0 0 12px 0' }}>
                {safeNumber(plan.duringActivity.waterPerHour)} ml per hour • Sip every 12-15 minutes
              </p>
            )}
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#888888', margin: '0 0 4px 0', textTransform: 'uppercase' }}>TOTAL SUPPLME SACHETS</p>
            <p style={{ fontSize: '32px', fontWeight: '900', color: '#000000', margin: '0 0 12px 0' }}>
              {plan.duringActivity.totalElectrolytes > 0 
                ? plan.duringActivity.totalElectrolytes
                : 'Not required'}
            </p>
            <p style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              color: '#666666', 
              margin: '16px 0 0 0',
              lineHeight: '1.4'
            }}>
              ⚡ {profile.disciplines?.includes('Running') ? 'Practical approach: Most runners carry minimal water' : 'Maintain performance throughout'}
            </p>
            {profile.disciplines?.includes('Running') && (
              <p style={{ 
                fontSize: '11px', 
                fontWeight: '500', 
                color: '#777777', 
                margin: '10px 0 0 0',
                lineHeight: '1.4'
              }}>
                Sachets are easy to carry • Water recommendations match typical carrying capacity
              </p>
            )}
          </div>
          )}

          {/* POST */}
          <div style={{ flex: '1', background: '#ffffff', padding: '20px 0' }}>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ 
                fontSize: '13px', 
                fontWeight: '700', 
                color: '#888888', 
                margin: '0 0 6px 0',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                400ML WITHIN 30 MINUTES, REMAINDER OVER 2-4 HOURS
              </p>
              <h2 style={{ 
                fontSize: '40px', 
                fontWeight: '900', 
                color: '#000000', 
                margin: '0',
                lineHeight: '1.1'
              }}>
                POST
              </h2>
            </div>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#888888', margin: '0 0 4px 0', textTransform: 'uppercase' }}>WATER (150% OF LOSS)</p>
            <p style={{ fontSize: '32px', fontWeight: '900', color: '#000000', margin: '0 0 4px 0' }}>{safeNumber(plan.postActivity.water)} ml</p>
            <p style={{ fontSize: '13px', fontWeight: '500', color: '#666666', margin: '0 0 12px 0' }}>Over 4-6 hours</p>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#888888', margin: '0 0 4px 0', textTransform: 'uppercase' }}>SUPPLME SACHET</p>
            <p style={{ fontSize: '32px', fontWeight: '900', color: '#000000', margin: '0 0 4px 0' }}>{safeNumber(plan.postActivity.electrolytes)}x</p>
            <p style={{ fontSize: '13px', fontWeight: '500', color: '#666666', margin: '0 0 12px 0' }}>With water intake</p>
            <p style={{ 
              fontSize: '13px', 
              fontWeight: '600', 
              color: '#666666', 
              margin: '16px 0 0 0',
              lineHeight: '1.4'
            }}>
              ⚡ Accelerate recovery and restore your body to peak condition
            </p>
          </div>
        </div>
      </div>

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
                  <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
                  <div className="relative p-8 md:p-10 space-y-6">
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
                        <h3 className="text-xl font-bold">Your Profile vs. Average Athlete</h3>
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

      {/* Race Day Protocol - Only shows if user is training for a race */}
      {profile.hasUpcomingRace && (
        <div className="space-y-6 scroll-mt-6" id="race-day-protocol">
          {/* Header + quick-jump nav */}
          <div className="text-center py-6 md:py-8 space-y-4">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase text-foreground">
              Race Day Protocol
            </h2>
            <p className="text-base md:text-lg font-semibold text-muted-foreground">Your 48-hour performance strategy</p>
            <nav className="flex overflow-x-auto overflow-y-hidden flex-nowrap gap-2 pt-2 pb-1 -mx-2 px-2 justify-start sm:justify-center [scrollbar-width:thin]" aria-label="Jump to section">
              <a href="#race-day-before" className="text-xs font-bold uppercase tracking-wider px-4 py-3 min-h-[44px] inline-flex items-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors whitespace-nowrap shrink-0 touch-manipulation">Day Before</a>
              <a href="#race-day-morning" className="text-xs font-bold uppercase tracking-wider px-4 py-3 min-h-[44px] inline-flex items-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors whitespace-nowrap shrink-0 touch-manipulation">Race Morning</a>
              {!(profile.disciplines?.includes('Swimming')) && (
                <a href="#race-day-during" className="text-xs font-bold uppercase tracking-wider px-4 py-3 min-h-[44px] inline-flex items-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors whitespace-nowrap shrink-0 touch-manipulation">During</a>
              )}
              <a href="#race-day-recovery" className="text-xs font-bold uppercase tracking-wider px-4 py-3 min-h-[44px] inline-flex items-center rounded-full bg-muted hover:bg-muted/80 text-foreground transition-colors whitespace-nowrap shrink-0 touch-manipulation">Recovery</a>
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
              <div className="p-4 md:p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <Droplets className="w-7 h-7 mb-2 text-foreground" />
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Hydrate</p>
                    <p className="text-xl font-black metric-number">2–3L</p>
                    <p className="text-xs text-muted-foreground">Throughout day</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <Zap className="w-7 h-7 mb-2 text-foreground" />
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">With dinner</p>
                    <p className="text-lg font-black metric-number">500ml + 2× Supplme</p>
                    <p className="text-xs text-muted-foreground">5–7pm for sleep</p>
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

            {/* 3. During Race (hidden for swimming) - dark card so all text stays readable */}
            {!(profile.disciplines?.includes('Swimming')) && (
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
                {profile.disciplines?.[0] === 'Triathlon' && (
                  <div className="rounded-xl bg-elite/20 border border-elite/50 px-4 py-3">
                    <p className="text-sm font-semibold text-elite">Triathlon: no sachets during the swim</p>
                    <p className="text-xs text-zinc-300 mt-1">You cannot take electrolyte sachets while swimming. The {plan.duringActivity.totalElectrolytes} sachets below are for <strong>bike and run only</strong>. Pre-load with 1 sachet before the start; take the rest in T1, on the bike, in T2, and on the run.</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Water per hour</p>
                    <p className="text-2xl md:text-3xl font-black metric-number text-white">{safeNumber(plan.duringActivity.waterPerHour)}ml</p>
                    <p className="text-xs text-zinc-300">Sip {plan.duringActivity.frequency.toLowerCase()}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-800 border border-zinc-700 text-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">Supplme total</p>
                    <p className="text-2xl md:text-3xl font-black metric-number text-white">{plan.duringActivity.totalElectrolytes} sachet{plan.duringActivity.totalElectrolytes !== 1 ? 's' : ''}</p>
                    {profile.disciplines?.[0] === 'Triathlon' && plan.duringActivity.totalElectrolytes > 0 && <p className="text-xs text-zinc-400">bike + run only</p>}
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
                  {profile.disciplines?.[0] === 'Triathlon' ? (
                    <p className="text-xs text-zinc-400 italic">Tip: Take sachets in T1, on the bike, in T2, and on the run — never during the swim. Pre-load with 1 sachet before the start.</p>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">Tip: Sip water steadily; take sachets at the suggested interval. Listen to your body and adjust if needed.</p>
                  )}
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
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>{plan.duringActivity.frequency}:</strong> Supplme sachet at aid station</li>
                    {safeNumber(plan.duringActivity.waterPerHour) > 0 && (
                      <li>• Drink {Math.round(safeNumber(plan.duringActivity.waterPerHour) / 2)}ml water every 15 minutes</li>
                    )}
                    <li>• For marathons: Aim for {plan.duringActivity.totalElectrolytes} sachets total during race</li>
                    <li>• For ultras: {safeNumber(plan.duringActivity.electrolytesPerHour)} sachet(s) per hour minimum</li>
                  </ul>
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
