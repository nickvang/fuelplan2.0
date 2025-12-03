import { useState, useEffect } from 'react';
import { HydrationPlan, HydrationProfile, AIEnhancedInsights } from '@/types/hydration';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplets, AlertCircle, Sparkles, ExternalLink, Calculator, BookOpen, Shield, RefreshCw, Share2, Loader2, Zap, Clock, TrendingUp, Flag, Activity, Target } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import supplmeLogo from '@/assets/supplme-logo.png';
import domtoimage from 'dom-to-image-more';

interface HydrationPlanDisplayProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
  onReset: () => void;
  onFullReset?: () => void;
  hasSmartWatchData?: boolean;
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

export function HydrationPlanDisplay({ plan: initialPlan, profile: initialProfile, onReset, onFullReset, hasSmartWatchData = false, rawSmartWatchData, version }: HydrationPlanDisplayProps) {
  const [aiInsights, setAiInsights] = useState<AIEnhancedInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  
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

  useEffect(() => {
    const fetchAIInsights = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('enhance-hydration-plan', {
          body: { profile, plan, hasSmartWatchData, rawSmartWatchData }
        });

        if (error) throw error;
        setAiInsights(data);
      } catch (error: any) {
        console.error('Failed to fetch AI insights:', error);
        toast({
          title: "AI Enhancement Unavailable",
          description: "Showing basic plan without AI insights.",
          variant: "destructive"
        });
      } finally {
        setLoadingInsights(false);
      }
    };

    fetchAIInsights();
  }, [plan, profile, hasSmartWatchData, rawSmartWatchData]);

  const handleDeleteMyData = async () => {
    if (!confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      return;
    }

    try {
      const deletionToken = localStorage.getItem('hydration_deletion_token');
      
      if (!deletionToken) {
        toast({
          title: "Cannot Delete Data",
          description: "No deletion token found. Data may have already been deleted or expired.",
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
        title: "Data Deleted Successfully",
        description: "Your data has been permanently deleted in compliance with GDPR.",
      });

      // Optionally redirect after deletion
      setTimeout(() => onReset(), 2000);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Failed to delete data:', error);
      }
      toast({
        title: "Deletion Failed",
        description: "Please contact info@supplme.com for manual data deletion.",
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
        title: "Generating Image...",
        description: "Creating your shareable protocol image",
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
        title: "Share Failed",
        description: "Unable to generate image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSharing(false);
    }
  };
      

  return (
    <div className="space-y-6 md:space-y-10 animate-in fade-in duration-700 px-4 md:px-0">
      {/* Epic Header - Achievement Unlocked Style */}
      <div className="relative overflow-hidden">
        {/* Background Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-chrome-light/20 via-transparent to-chrome-light/20 blur-3xl"></div>
        
        <div className="relative text-center space-y-2 py-2">
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
          
          {/* Smartwatch Data Badge - Athletic Style */}
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

      {/* Smartwatch Data Info Banner - Chrome Style */}
      {hasSmartWatchData && (
        <Alert className="athletic-card border-chrome/30 bg-chrome/5">
          <Sparkles className="h-5 w-5 text-chrome-dark" />
          <AlertTitle className="text-lg font-bold text-foreground">Performance Optimized with Your Metrics</AlertTitle>
          <AlertDescription className="text-base">
            This plan leverages your physiological data, sleep patterns, activity history, and recovery metrics for elite-level accuracy.
          </AlertDescription>
        </Alert>
      )}

      {/* Fluid Loss Summary - Bold Athletic Card */}
      <Card className="athletic-card p-4 md:p-8 bg-gradient-to-br from-chrome/10 to-background border-chrome">
        <div className="text-center space-y-2 md:space-y-3">
          <p className="text-xs md:text-sm font-bold tracking-wider uppercase text-muted-foreground">Total Fluid Loss</p>
          <p className="text-4xl md:text-6xl font-black text-foreground">
            {(() => {
              const liters = plan.totalFluidLoss / 1000;
              return Math.round(liters * 10) / 10;
            })()} L
          </p>
          <p className="text-sm md:text-base font-semibold text-muted-foreground">
            during your {profile.sessionDuration < 1 
              ? `${Math.round(profile.sessionDuration * 60)} minute` 
              : formatHoursAsTime(profile.sessionDuration)} {profile.disciplines?.[0] || 'activity'}
          </p>
          {hasSmartWatchData && (
            <p className="text-xs md:text-sm font-semibold text-chrome-dark flex items-center justify-center gap-2">
              <Zap className="w-3 h-3 md:w-4 md:h-4" /> Calculated from your actual training data
            </p>
          )}
        </div>
      </Card>

      {/* Share Button */}
      <div className="text-center pt-2 pb-4">
        <Button 
          onClick={handleShare} 
          disabled={isSharing}
          variant="outline"
          size="lg"
          className="gap-2 font-bold"
        >
          {isSharing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <Share2 className="w-5 h-5" />
              Share Protocol
            </>
          )}
        </Button>
      </div>

      {/* Responsive Display Version - Visible on all devices */}
      <div className="space-y-6 md:space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 p-6 md:p-8 border-4 border-foreground rounded-2xl bg-background">
          <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tight uppercase text-foreground" style={{ letterSpacing: '0.05em' }}>
            YOUR PERFORMANCE PROTOCOL
          </h2>
          
          {profile.raceDistance && (
            <div className="inline-block px-6 md:px-10 py-3 md:py-5 rounded-2xl bg-foreground">
              <p className="text-3xl md:text-5xl lg:text-6xl font-black text-background">
                {distance} KM
              </p>
            </div>
          )}
          
          <p className="text-lg md:text-2xl font-bold uppercase tracking-wide text-foreground opacity-90">
            {formatHoursAsTime(profile.sessionDuration)} {profile.disciplines?.[0] || 'Activity'} Session
          </p>
        </div>

        {/* Three Phase Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* PRE */}
          <Card className="p-6 md:p-8 space-y-4 md:space-y-5 bg-card border-2 border-border">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-bold uppercase tracking-wider">{plan.preActivity.timing}</span>
              </div>
              <h3 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground">PRE</h3>
            </div>
            
            <div className="space-y-3">
              <div className="bg-secondary/50 p-4 md:p-5 rounded-xl border border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">WATER</p>
                <p className="text-3xl md:text-4xl font-black text-foreground">{plan.preActivity.water} ml</p>
                <p className="text-xs font-semibold text-muted-foreground mt-2">Drink 2 hours before</p>
              </div>
              <div className="bg-secondary/50 p-4 md:p-5 rounded-xl border border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">SUPPLME SACHET (30ML)</p>
                <p className="text-3xl md:text-4xl font-black text-foreground">{plan.preActivity.electrolytes}x</p>
              </div>
            </div>

            <p className="text-sm font-medium text-muted-foreground border-t border-border pt-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Prime your body with optimal fluid balance
            </p>
          </Card>

          {/* DURING */}
          {!(profile.disciplines?.includes('Swimming') && profile.hasUpcomingRace) && (
          <Card className="p-6 md:p-8 space-y-4 md:space-y-5 bg-foreground border-2 border-foreground">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-background/70">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-bold uppercase tracking-wider">{plan.duringActivity.frequency}</span>
              </div>
              <h3 className="text-4xl md:text-5xl lg:text-6xl font-black text-background">DURING</h3>
            </div>
            
            <div className="space-y-3">
              <div className="bg-background/10 p-4 md:p-5 rounded-xl border border-background/20">
                <p className="text-xs font-bold uppercase tracking-wider text-background/70 mb-2">TOTAL WATER</p>
                <p className="text-3xl md:text-4xl font-black text-background">
                  {safeNumber(plan.duringActivity.waterPerHour) > 0 
                    ? `${Math.round(safeNumber(plan.duringActivity.waterPerHour) * profile.sessionDuration)} ml` 
                    : 'As needed'}
                </p>
                <p className="text-sm font-semibold text-background/85 mt-2">
                  {safeNumber(plan.duringActivity.waterPerHour) > 0 ? `${safeNumber(plan.duringActivity.waterPerHour)} ml per hour` : ''}
                </p>
                <p className="text-xs font-semibold text-background/60 mt-1">
                  {safeNumber(plan.duringActivity.waterPerHour) > 0 ? `Sip every 12-15 minutes` : ''}
                </p>
              </div>
              <div className="bg-background/10 p-4 md:p-5 rounded-xl border border-background/20">
                <p className="text-xs font-bold uppercase tracking-wider text-background/70 mb-2">TOTAL SUPPLME SACHETS</p>
                <p className="text-3xl md:text-4xl font-black text-background">
                  {plan.duringActivity.totalElectrolytes > 0 
                    ? plan.duringActivity.totalElectrolytes
                    : 'Not required'}
                </p>
              </div>
            </div>

            <p className="text-sm font-medium text-background/70 border-t border-background/20 pt-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> {profile.disciplines?.includes('Running') ? 'Most runners carry minimal water' : 'Maintain performance'}
            </p>
          </Card>
          )}

          {/* POST */}
          <Card className="p-6 md:p-8 space-y-4 md:space-y-5 bg-card border-2 border-border">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-xs md:text-sm font-bold uppercase tracking-wider">{plan.postActivity.timing}</span>
              </div>
              <h3 className="text-4xl md:text-5xl lg:text-6xl font-black text-foreground">POST</h3>
            </div>
            
            <div className="space-y-3">
              <div className="bg-secondary/50 p-4 md:p-5 rounded-xl border border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">WATER (150% OF LOSS)</p>
                <p className="text-3xl md:text-4xl font-black text-foreground">{safeNumber(plan.postActivity.water)} ml</p>
                <p className="text-xs font-semibold text-muted-foreground mt-2">Over 4-6 hours</p>
              </div>
              <div className="bg-secondary/50 p-4 md:p-5 rounded-xl border border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">SUPPLME SACHET</p>
                <p className="text-3xl md:text-4xl font-black text-foreground">{safeNumber(plan.postActivity.electrolytes)}x</p>
                <p className="text-xs font-semibold text-muted-foreground mt-2">With water intake</p>
              </div>
            </div>

            <p className="text-sm font-medium text-muted-foreground border-t border-border pt-4 flex items-center gap-2">
              <Zap className="w-4 h-4" /> Accelerate recovery and restore
            </p>
          </Card>
        </div>
      </div>

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

      {/* Why So Many Sachets? Scientific Explainer */}
      {(() => {
        // Calculate sodium loss per hour based on sweat saltiness
        const sodiumLossPerHour = {
          'low': 400,    // 300-500 mg/hour range
          'medium': 650, // 500-800 mg/hour range
          'high': 1100,  // 800-1400 mg/hour range
        }[profile.sweatSaltiness] || 650;
        
        const totalSodiumLoss = sodiumLossPerHour * profile.sessionDuration;
        const sachetsPerHour = plan.duringActivity.electrolytesPerHour || 1;
        const totalSachets = Math.round(sachetsPerHour * profile.sessionDuration) + plan.preActivity.electrolytes + plan.postActivity.electrolytes;
        
        return (
          <Card className="p-6 md:p-8 bg-gradient-to-br from-primary/5 to-background border-primary/30">
            <div className="flex items-start gap-3 mb-4">
              <BookOpen className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <h3 className="text-xl md:text-2xl font-black text-foreground">The Science Behind Your Sachet Dosing</h3>
            </div>
            
            <div className="space-y-6 text-muted-foreground">
              {/* Sodium Loss Section */}
              <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <Droplets className="w-4 h-4 text-primary" />
                  Your Sodium Loss Rate
                </h4>
                <p className="leading-relaxed">
                  Based on your <strong className="text-foreground">{profile.sweatSaltiness} sweat saltiness</strong> profile, 
                  you lose approximately <strong className="text-foreground text-lg">{sodiumLossPerHour} mg of sodium per hour</strong> during exercise.
                  Over your <strong className="text-foreground">{formatHoursAsTime(profile.sessionDuration)} session</strong>, 
                  that equals <strong className="text-foreground">{Math.round(totalSodiumLoss)} mg total sodium loss</strong>.
                </p>
                <p className="text-sm mt-2 italic">
                  Research shows sweat sodium concentrations range from 300-1400 mg/hour depending on individual physiology, 
                  genetics, heat acclimatization, and training status (Baker et al., 2016).
                </p>
              </div>

              {/* Why Sodium Matters */}
              <div>
                <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Why Sodium is the Primary Driver
                </h4>
                <p className="leading-relaxed">
                  Sodium is the most abundant electrolyte lost in sweat and the <strong className="text-foreground">primary determinant of fluid retention</strong>. 
                  When sodium levels drop (hyponatremia), your body cannot hold onto water effectively—drinking more plain water 
                  actually <em>dilutes</em> blood sodium further, worsening the problem. This is why elite athletes and 
                  sports physiologists prioritize sodium replacement above all other electrolytes.
                </p>
              </div>

              {/* SUPPLME Profile */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-transparent border-l-4 border-primary">
                <h4 className="font-bold text-foreground mb-3">Each SUPPLME Sachet Delivers:</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-bold text-foreground">500 mg Sodium (Na⁺)</p>
                    <p className="text-xs">Fluid balance & cramp prevention</p>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-bold text-foreground">250 mg Potassium (K⁺)</p>
                    <p className="text-xs">Muscle contraction & nerve signaling</p>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-bold text-foreground">100 mg Magnesium (Mg²⁺)</p>
                    <p className="text-xs">Prevents neuromuscular fatigue</p>
                  </div>
                  <div className="p-2 rounded bg-background/50">
                    <p className="font-bold text-foreground">230 mg Chloride (Cl⁻)</p>
                    <p className="text-xs">Fluid balance & pH regulation</p>
                  </div>
                  <div className="p-2 rounded bg-background/50 md:col-span-2">
                    <p className="font-bold text-foreground">1380 mg Citrate</p>
                    <p className="text-xs">Buffers lactic acid buildup, supports endurance performance</p>
                  </div>
                </div>
              </div>

              {/* Why This Dose */}
              <div>
                <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-primary" />
                  Your Personalized Calculation
                </h4>
                <p className="leading-relaxed mb-3">
                  With <strong className="text-foreground">{sodiumLossPerHour} mg sodium loss/hour</strong> and each sachet providing 
                  <strong className="text-foreground"> 500 mg sodium</strong>, you need approximately 
                  <strong className="text-foreground"> {(sodiumLossPerHour / 500).toFixed(1)} sachets/hour</strong> for full replacement.
                  After applying adjustments for your weight ({profile.weight}kg), environment ({(profile.trainingTempRange.min + profile.trainingTempRange.max) / 2}°C), 
                  and sweat rate ({profile.sweatRate}), your recommended dosing is <strong className="text-foreground">{sachetsPerHour} sachet{sachetsPerHour !== 1 ? 's' : ''}/hour</strong>.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                  <div className="p-2 rounded bg-secondary/50">
                    <p className="font-semibold text-foreground">Weight Factor</p>
                    <p className="text-xs">{profile.weight < 65 ? 'Lighter athletes: reduced need' : profile.weight > 95 ? 'Heavier athletes: increased need' : 'Standard adjustment applied'}</p>
                  </div>
                  <div className="p-2 rounded bg-secondary/50">
                    <p className="font-semibold text-foreground">Temperature Factor</p>
                    <p className="text-xs">{(profile.trainingTempRange.min + profile.trainingTempRange.max) / 2 > 25 ? 'Hot conditions: +25-40% sodium loss' : (profile.trainingTempRange.min + profile.trainingTempRange.max) / 2 < 15 ? 'Cool conditions: -10-15% sodium loss' : 'Moderate temp: standard rate'}</p>
                  </div>
                  <div className="p-2 rounded bg-secondary/50">
                    <p className="font-semibold text-foreground">Duration Factor</p>
                    <p className="text-xs">{profile.sessionDuration >= 4 ? 'Ultra-endurance: cumulative losses compound' : profile.sessionDuration >= 2 ? 'Extended effort: consistent replacement critical' : 'Standard session duration'}</p>
                  </div>
                </div>
              </div>

              {/* Consequences of Under-dosing */}
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <h4 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Why Lower Dosing Causes Problems
                </h4>
                <p className="leading-relaxed mb-2">
                  Insufficient sodium replacement during prolonged exercise leads to:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Progressive dehydration</strong> – body cannot retain fluids without adequate sodium</li>
                  <li><strong>Muscle cramps</strong> – sodium is essential for proper muscle contraction</li>
                  <li><strong>Declining pace</strong> – reduced plasma volume impairs oxygen delivery</li>
                  <li><strong>Elevated heart rate</strong> – heart works harder to pump thickened blood</li>
                  <li><strong>Cognitive impairment</strong> – even 2% dehydration affects decision-making</li>
                </ul>
              </div>

              {/* Ultra Note */}
              {profile.sessionDuration >= 4 && (
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/30">
                  <p className="font-bold text-foreground mb-1">⚡ Critical Note for Ultra-Endurance (4h+)</p>
                  <p className="text-sm">
                    Long ultras require <strong>300-800 mg sodium/hour</strong> depending on sweat saltiness. 
                    SUPPLME sachets deliver 500 mg sodium each, so athletes with high sweat saltiness may need 
                    multiple sachets per hour to match physiological losses. Under-fueling is the #1 cause of 
                    DNF in ultra events.
                  </p>
                </div>
              )}

              {/* Scientific References */}
              <div className="pt-4 border-t border-border">
                <h4 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-primary" />
                  Scientific References
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="p-2 rounded bg-secondary/30">
                    <p className="font-semibold">American College of Sports Medicine (2007)</p>
                    <p className="italic">"Exercise and Fluid Replacement" – Position Stand</p>
                    <p className="text-muted-foreground">Med Sci Sports Exerc. 39(2):377-90 | <a href="https://pubmed.ncbi.nlm.nih.gov/17277604/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PMID: 17277604</a></p>
                  </div>
                  <div className="p-2 rounded bg-secondary/30">
                    <p className="font-semibold">Baker et al. (2016)</p>
                    <p className="italic">"Normative data for regional sweat sodium concentration"</p>
                    <p className="text-muted-foreground">J Sports Sci. 34(4):358-68 | <a href="https://pubmed.ncbi.nlm.nih.gov/26070030/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PMID: 26070030</a></p>
                  </div>
                  <div className="p-2 rounded bg-secondary/30">
                    <p className="font-semibold">Goulet (2012)</p>
                    <p className="italic">"Effect of exercise-induced dehydration on endurance performance"</p>
                    <p className="text-muted-foreground">Br J Sports Med. 46(4):259-65 | <a href="https://pubmed.ncbi.nlm.nih.gov/21659364/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PMID: 21659364</a></p>
                  </div>
                  <div className="p-2 rounded bg-secondary/30">
                    <p className="font-semibold">Sawka et al. (2015)</p>
                    <p className="italic">"Hypohydration and human performance: Impact of environment and physiological mechanisms"</p>
                    <p className="text-muted-foreground">Sports Med. 45 Suppl 1:S51-60 | <a href="https://pubmed.ncbi.nlm.nih.gov/26553489/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PMID: 26553489</a></p>
                  </div>
                </div>
              </div>

              {version === 'simple' && (
                <div className="pt-4 border-t border-primary/20">
                  <p className="leading-relaxed text-primary font-semibold">
                    💡 Want even more precision? Take our <strong>Pro/Advanced version</strong> for detailed environmental 
                    and physiological customization, or <strong>upload data from your smartwatch/device</strong> for 
                    AI-powered insights based on your actual recovery and performance metrics.
                  </p>
                </div>
              )}
            </div>
          </Card>
        );
      })()}

      {/* Race Day Protocol - Only shows if user is training for a race */}
      {profile.hasUpcomingRace && (
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center py-8 space-y-2">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight uppercase text-foreground">
              Race Day Protocol
            </h2>
            <p className="text-lg font-semibold text-primary">Your 48-hour performance strategy</p>
          </div>

          {/* Timeline Flow */}
          <div className="relative">
            {/* Vertical Timeline Line - Hidden on mobile */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/50 to-primary transform -translate-x-1/2" />
            
            <div className="space-y-12">
              {/* Day Before - Right Side */}
              <div className="relative lg:grid lg:grid-cols-2 lg:gap-12 items-center">
                <div className="hidden lg:block" />
                <Card className="relative p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-3.5 md:space-y-4 border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-lg">
                  <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground hidden lg:flex">
                    1
                  </div>
                  <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
                    <span className="text-3xl sm:text-3xl md:text-4xl">🗓️</span>
                    <div>
                      <h3 className="text-lg sm:text-xl md:text-2xl font-black uppercase">Day Before</h3>
                      <p className="text-xs sm:text-sm md:text-sm text-muted-foreground font-semibold">T-24 Hours</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 sm:gap-2.5 md:gap-3">
                    <div className="p-3 sm:p-3.5 md:p-4 rounded-lg bg-gradient-to-br from-background to-muted border border-border">
                      <Droplets className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 mb-1 sm:mb-1.5 md:mb-2 text-foreground" />
                      <p className="text-[10px] sm:text-xs md:text-xs font-bold text-primary uppercase">Hydrate</p>
                      <p className="text-xl sm:text-xl md:text-2xl font-black">2-3L</p>
                      <p className="text-[10px] sm:text-xs md:text-xs text-muted-foreground">Throughout day</p>
                    </div>
                    <div className="p-3 sm:p-3.5 md:p-4 rounded-lg bg-gradient-to-br from-background to-muted border border-border">
                      <Zap className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 mb-1 sm:mb-1.5 md:mb-2 text-foreground" />
                      <p className="text-[10px] sm:text-xs md:text-xs font-bold text-primary uppercase">Evening</p>
                      <p className="text-base sm:text-lg md:text-2xl font-black break-words">500ml + 2x Supplme</p>
                      <p className="text-[10px] sm:text-xs md:text-xs text-muted-foreground">Pre-load electrolytes</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs sm:text-sm md:text-sm font-semibold text-foreground">🚫 Avoid: Alcohol • New foods • Late caffeine</p>
                  </div>
                </Card>
              </div>

              {/* Race Morning - Left Side */}
              <div className="relative lg:grid lg:grid-cols-2 lg:gap-12 items-center">
                <Card className="relative p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-3.5 md:space-y-4 border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-lg">
                  <div className="absolute -right-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground hidden lg:flex">
                    2
                  </div>
                  <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
                    <span className="text-3xl sm:text-3xl md:text-4xl">🌅</span>
                    <div>
                      <h3 className="text-lg sm:text-xl md:text-2xl font-black uppercase">Race Morning</h3>
                      <p className="text-xs sm:text-sm md:text-sm text-muted-foreground font-semibold">T-3 Hours</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 sm:space-y-2.5 md:space-y-3">
                    <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-gradient-to-r from-primary/20 to-background border-l-4 border-primary">
                      <span className="text-xl sm:text-xl md:text-2xl font-black text-primary flex-shrink-0">-3h</span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm md:text-sm font-bold truncate">{plan.preActivity.water}ml + Breakfast</p>
                        <p className="text-[10px] sm:text-xs md:text-xs text-muted-foreground">Wake up hydration</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-gradient-to-r from-primary/20 to-background border-l-4 border-primary">
                      <span className="text-xl sm:text-xl md:text-2xl font-black text-primary flex-shrink-0">-2h</span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm md:text-sm font-bold break-words">{plan.preActivity.electrolytes}x Supplme + 300ml</p>
                        <p className="text-[10px] sm:text-xs md:text-xs text-muted-foreground">Last substantial intake</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3 p-2 sm:p-2.5 md:p-3 rounded-lg bg-gradient-to-r from-primary/20 to-background border-l-4 border-primary">
                      <span className="text-xl sm:text-xl md:text-2xl font-black text-primary flex-shrink-0">-30m</span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm md:text-sm font-bold break-words">Small sips only (100-150ml)</p>
                        <p className="text-[10px] sm:text-xs md:text-xs text-muted-foreground">Final bathroom break</p>
                      </div>
                    </div>
                  </div>
                </Card>
                <div className="hidden md:block" />
              </div>

              {/* During Race - Right Side (Hidden for swimming races) */}
              {!(profile.disciplines?.includes('Swimming')) && (
              <div className="relative lg:grid lg:grid-cols-2 lg:gap-12 items-center">
                <div className="hidden lg:block" />
                <Card className="relative p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-3.5 md:space-y-4 border-4 border-primary shadow-xl" style={{ backgroundColor: '#0a0a0a' }}>
                  <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground hidden lg:flex">
                    3
                  </div>
                  <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                      <Flag className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6" style={{ color: '#ffffff' }} />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl md:text-2xl font-black uppercase" style={{ color: '#ffffff' }}>During Race</h3>
                      <p className="text-xs sm:text-sm md:text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Execute the plan</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                    <div className="p-3 sm:p-4 md:p-5 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)' }}>
                      <p className="text-[10px] sm:text-xs md:text-xs font-bold uppercase tracking-wider mb-1 sm:mb-1.5 md:mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Water per hour</p>
                      <p className="text-xl sm:text-2xl md:text-4xl font-black mb-1 leading-tight" style={{ color: '#ffffff' }}>{safeNumber(plan.duringActivity.waterPerHour)}ml</p>
                      <p className="text-[10px] sm:text-xs md:text-xs font-semibold break-words" style={{ color: 'rgba(255,255,255,0.7)' }}>Sip {plan.duringActivity.frequency.toLowerCase()}</p>
                    </div>
                    <div className="p-3 sm:p-4 md:p-5 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)' }}>
                      <p className="text-[10px] sm:text-xs md:text-xs font-bold uppercase tracking-wider mb-1 sm:mb-1.5 md:mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Supplme total</p>
                      <p className="text-xl sm:text-2xl md:text-4xl font-black mb-1 break-words leading-tight" style={{ color: '#ffffff' }}>
                        {plan.duringActivity.totalElectrolytes} sachet
                        {plan.duringActivity.totalElectrolytes !== 1 ? 's' : ''}
                      </p>
                      {(() => {
                        const totalSachets = plan.duringActivity.totalElectrolytes;
                        const totalMinutes = profile.sessionDuration * 60;
                        const minutesPerSachet = totalSachets > 0 ? Math.round(totalMinutes / totalSachets) : 0;
                        const sodiumPerHour = Math.round(plan.duringActivity.electrolytesPerHour * 500);
                        
                        return totalSachets > 0 ? (
                          <>
                            <p className="text-[10px] sm:text-xs md:text-xs font-semibold mb-1 break-words" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              1 every {minutesPerSachet >= 60 
                                ? formatHoursAsTime(minutesPerSachet / 60)
                                : `${minutesPerSachet} min`}
                            </p>
                            <p className="text-[9px] sm:text-[10px] md:text-xs font-bold pt-1 sm:pt-1.5 md:pt-2 border-t border-white/20 break-words leading-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
                              {totalSachets} total ({sodiumPerHour}mg/h)
                            </p>
                          </>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-2 sm:p-2.5 md:p-3 rounded-lg bg-primary/20 border border-primary/30">
                    <Activity className="w-4 h-4 sm:w-4.5 sm:h-4.5 md:w-5 md:h-5 text-primary flex-shrink-0" />
                    <p className="text-[10px] sm:text-xs md:text-xs font-semibold text-primary-foreground">
                      Listen to your body • Adjust as needed
                    </p>
                  </div>
                </Card>
              </div>
              )}

              {/* Post Race - Left Side */}
              <div className="relative lg:grid lg:grid-cols-2 lg:gap-12 items-center">
                <Card className="relative p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-3.5 md:space-y-4 border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-lg">
                  <div className="absolute -right-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground hidden lg:flex">
                    4
                  </div>
                  <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Target className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg sm:text-xl md:text-2xl font-black uppercase">Recovery</h3>
                      <p className="text-xs sm:text-sm md:text-sm text-muted-foreground font-semibold">4-6 Hour Window</p>
                    </div>
                  </div>
                  
                  <div className="relative pt-3 sm:pt-3.5 md:pt-4">
                    <div className="space-y-3 sm:space-y-3.5 md:space-y-4">
                      <div className="flex gap-2 sm:gap-2.5 md:gap-3">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 md:w-8 md:h-8 rounded-full bg-primary flex items-center justify-center text-[10px] sm:text-xs md:text-xs font-black text-primary-foreground">0h</div>
                          <div className="w-0.5 h-10 sm:h-11 md:h-12 bg-primary/30"></div>
                        </div>
                        <div className="flex-1 pb-3 sm:pb-3.5 md:pb-4 min-w-0">
                          <p className="font-bold text-xs sm:text-sm md:text-sm">Immediate</p>
                          <p className="text-[10px] sm:text-xs md:text-xs text-muted-foreground break-words">500ml + {safeNumber(plan.postActivity.electrolytes)}x Supplme</p>
                        </div>
                      </div>
                      <div className="flex gap-2 sm:gap-2.5 md:gap-3">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 md:w-8 md:h-8 rounded-full bg-primary/70 flex items-center justify-center text-[10px] sm:text-xs md:text-xs font-black text-primary-foreground">2h</div>
                          <div className="w-0.5 h-10 sm:h-11 md:h-12 bg-primary/30"></div>
                        </div>
                        <div className="flex-1 pb-3 sm:pb-3.5 md:pb-4 min-w-0">
                          <p className="font-bold text-xs sm:text-sm md:text-sm">First Phase</p>
                          <p className="text-[10px] sm:text-xs md:text-xs text-muted-foreground break-words">{safeNumber(Math.round(plan.postActivity.water * 0.5))}ml + protein meal</p>
                        </div>
                      </div>
                      <div className="flex gap-2 sm:gap-2.5 md:gap-3">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <div className="w-7 h-7 sm:w-7.5 sm:h-7.5 md:w-8 md:h-8 rounded-full bg-primary/40 flex items-center justify-center text-[10px] sm:text-xs md:text-xs font-black text-primary-foreground">6h</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-xs sm:text-sm md:text-sm">Complete</p>
                          <p className="text-[10px] sm:text-xs md:text-xs text-muted-foreground break-words">{safeNumber(plan.postActivity.water)}ml total (150% loss)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs sm:text-sm md:text-sm font-semibold text-foreground">✓ Target: Pale yellow urine by evening</p>
                  </div>
                </Card>
                <div className="hidden md:block" />
              </div>
            </div>
          </div>

          {/* Quick Tips - Compact */}
          <Alert className="border-2 border-primary/30 bg-gradient-to-r from-primary/10 to-background">
            <Activity className="h-5 w-5 text-primary" />
            <AlertTitle className="text-lg font-black uppercase">Pro Tips</AlertTitle>
            <AlertDescription className="text-sm space-y-1 mt-2">
              <p>✓ Practice protocol in training</p>
              <p>✓ Pack {plan.duringActivity.totalElectrolytes}x Supplme sachets</p>
              <p>✓ Check weather 48hrs before • Adjust if needed</p>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Advanced Athlete Insights - Clinical Performance Dashboard */}
      {version === 'pro' && (
        <div className="space-y-6">
          {loadingInsights && (
            <Card className="border-0 shadow-lg bg-gradient-to-br from-muted/30 to-muted/10">
              <div className="flex items-center justify-center gap-3 p-8">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <div className="text-center">
                  <p className="text-base font-semibold text-foreground">Analyzing Your Physiology</p>
                  <p className="text-sm text-muted-foreground">Processing performance data...</p>
                </div>
              </div>
            </Card>
          )}

          {aiInsights && (
            <div className="space-y-6">
              {/* Bold Finding - Hero Statement */}
              <Card className="border-0 shadow-2xl bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
                <div className="relative p-8 md:p-10 space-y-6">
                  {/* Header */}
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

                  {/* Summary sentence */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {profile.sweatRate === 'high' && profile.sweatSaltiness === 'high' 
                      ? `You're a high-volume sweater with elevated sodium loss. This requires aggressive electrolyte replacement to maintain performance and prevent cramping.`
                      : profile.sweatRate === 'high'
                      ? `Your high sweat rate means you lose significantly more fluid than average athletes during exercise.`
                      : profile.sweatSaltiness === 'high'
                      ? `Your sweat contains higher sodium concentrations than average, increasing your risk for cramping without proper electrolyte replacement.`
                      : `Your hydration profile falls within typical ranges for endurance athletes—standard protocols work well with environmental adjustments.`}
                  </p>

                  {/* Profile Analysis - Bar Graph Comparison */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-xl font-bold">Your Profile vs. Average Athlete</h3>
                    </div>

                    {/* Visual Comparison Bars */}
                    <div className="space-y-5">
                      {/* Sweat Rate */}
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

                      {/* Sweat Sodium */}
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

                      {/* Total Fluid Loss */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-foreground">Total Fluid Loss</span>
                            <span className="text-muted-foreground font-mono font-medium">
                              {safeNumber(plan.totalFluidLoss) ? Math.round(safeNumber(plan.totalFluidLoss)) : 'N/A'}ml
                            </span>
                          </div>
                        <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                          {(() => {
                            // Calculate hourly rate for proper comparison
                            const hourlyRate = plan.totalFluidLoss / profile.sessionDuration;
                            const barWidth = hourlyRate < 600 ? '30%' : 
                                           hourlyRate < 800 ? '50%' : 
                                           hourlyRate < 1000 ? '65%' : 
                                           '85%';
                            const barColor = hourlyRate < 600 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                           hourlyRate < 1000 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                                           'bg-gradient-to-r from-amber-500 to-red-500';
                            return (
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: barWidth }}
                              />
                            );
                          })()}
                          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-foreground/30" />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Low (&lt;{Math.round(600 * profile.sessionDuration)}ml)</span>
                          <span className="font-medium">Average (~{Math.round(800 * profile.sessionDuration)}ml)</span>
                          <span>High (&gt;{Math.round(1000 * profile.sessionDuration)}ml)</span>
                        </div>
                      </div>

                      {/* Hydration Intensity Needs */}
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

                    {/* Key Insight Summary */}
                    <div className="mt-6 p-4 bg-muted/50 rounded-xl border border-border/50">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {safeNumber(plan.totalFluidLoss) && profile.sessionDuration ? (
                          profile.sweatRate === 'high' && profile.sweatSaltiness === 'high' 
                            ? `⚡ You lose significantly more sodium and fluid than the average athlete. Your estimated ${Math.round(safeNumber(plan.totalFluidLoss))}ml total fluid loss, combined with elevated sweat sodium, requires aggressive electrolyte replacement throughout your ${formatHoursAsTime(profile.sessionDuration)} session. Without adequate replacement, you risk hyponatremia, cramping, and performance decline.`
                            : profile.sweatRate === 'high'
                            ? `⚡ Your elevated sweat rate means you'll lose approximately ${Math.round(safeNumber(plan.totalFluidLoss))}ml during this ${formatHoursAsTime(profile.sessionDuration)} session, which is above average. Precise timing is critical: consume ${safeNumber(plan.duringActivity.waterPerHour)}ml/hr with electrolytes ${plan.duringActivity.frequency.toLowerCase()} to maintain performance.`
                            : profile.sweatSaltiness === 'high'
                            ? `⚡ Your sweat has elevated sodium concentration, increasing cramping risk. While your fluid loss (${Math.round(safeNumber(plan.totalFluidLoss))}ml) is normal, each liter contains more sodium. The ${safeNumber(plan.duringActivity.electrolytesPerHour)} Supplme sachets/hr provide precise electrolyte ratios to maintain neuromuscular function.`
                            : `✓ Your balanced profile allows standard evidence based protocols. Your ${Math.round(safeNumber(plan.totalFluidLoss))}ml total fluid loss over ${formatHoursAsTime(profile.sessionDuration)} means you're losing approximately ${Math.round(safeNumber(plan.totalFluidLoss) / profile.sessionDuration)}ml per hour, which is within the normal range for endurance athletes (600 to 1000ml/hr). This moderate sweat rate, combined with your medium sodium loss, means 1 sachet per hour provides optimal electrolyte replacement. Your hydration needs align with ACSM guidelines, adjusted for your environmental conditions.`
                        ) : (
                          `Please provide a session duration or distance to calculate your personalized fluid loss and hydration recommendations.`
                        )}
                        {profile.altitudeMeters > 1000 && (
                          <span className="block mt-2 font-medium text-foreground">
                            🏔️ Training at {profile.altitudeMeters}m altitude increases respiratory water loss by {profile.altitudeMeters > 2500 ? '15-20%' : '10-15%'}—this has been factored into your plan.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>


              {/* Do This First - Priority Actions */}
              <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/10 via-primary/5 to-card">
                <div className="p-6 md:p-8 space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="text-xl font-bold">Tips</h4>
                  </div>

                  <div className="space-y-3">
                    {plan.recommendations
                      .filter(rec => 
                        !rec.includes('Each 30ml Supplme sachet provides') &&
                        !rec.includes('Drink Supplme sachets directly')
                      )
                      .slice(0, 5)
                      .map((rec, index) => (
                        <div 
                          key={index} 
                          className="group flex gap-4 items-start p-4 rounded-xl bg-card border border-border/50 hover:border-primary/50 hover:shadow-md transition-all duration-200"
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-sm group-hover:bg-primary/20 transition-colors">
                            {index + 1}
                          </div>
                          <p className="text-sm font-medium text-foreground leading-relaxed pt-0.5">{rec}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </Card>

              {/* Critical Alerts - If Present */}
              {(aiInsights.risk_factors || aiInsights.professional_recommendation) && (
                <div className="grid md:grid-cols-2 gap-4">
                  {aiInsights.risk_factors && (
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100/30 dark:from-amber-950/30 dark:to-amber-900/10">
                      <div className="p-6 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <h4 className="text-base font-bold text-amber-900 dark:text-amber-200">Risk Factors</h4>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                          {aiInsights.risk_factors}
                        </p>
                      </div>
                    </Card>
                  )}

                  {aiInsights.professional_recommendation && (
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-primary/10 to-primary/5">
                      <div className="p-6 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                            <Target className="w-5 h-5 text-primary" />
                          </div>
                          <h4 className="text-base font-bold">Expert Recommendation</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {aiInsights.professional_recommendation}
                        </p>
                      </div>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {/* Action Buttons - Right under the adjustment tool */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button onClick={onReset} variant="outline" size="lg" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Adjust My Data
        </Button>
        {onFullReset && (
          <Button 
            onClick={onFullReset} 
            variant="outline" 
            size="lg" 
            className="gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            Start Completely Fresh
          </Button>
        )}
      </div>

      {/* Supplme Product Info - Moved here */}
      <Card className="p-6 bg-accent/30">
        <div className="flex flex-col items-center gap-4">
          <h4 className="font-semibold text-lg">Supplme Liquid Electrolyte</h4>
          <p className="text-sm text-muted-foreground text-center">
            30ml sachets • 500mg Sodium • 250mg Potassium • 100mg Magnesium • 1380mg Citrate • 230mg Chloride
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Drink directly from sachet - no mixing required
          </p>
          <Button variant="default" size="lg" asChild className="w-full sm:w-auto">
            <a href="https://www.supplme.com/products/electrolyte-28-pack-clementine-salt" target="_blank" rel="noopener noreferrer">
              Buy Supplme
            </a>
          </Button>
        </div>
      </Card>

      {/* Race Day Hydration Guide */}
      {profile.upcomingEvents && (
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
                    <div className="space-y-3">
                      <div className="border-l-4 border-blue-500 pl-3">
                        <p className="text-sm font-semibold">🏊 <strong>Swim Segment</strong></p>
                        <p className="text-sm text-muted-foreground mt-1">Pre-loaded from pre-race sachet (taken 2 hours before)</p>
                        <p className="text-xs text-muted-foreground italic mt-1">No additional nutrition needed during swim</p>
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


      {/* Calculation Transparency */}
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

      {/* Scientific References */}
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

      {/* Bottom Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button variant="default" size="lg" asChild className="w-full sm:w-auto">
          <a href="https://www.supplme.com/products/electrolyte-28-pack-clementine-salt" target="_blank" rel="noopener noreferrer">
            Buy Supplme
          </a>
        </Button>
        <Button onClick={onFullReset || onReset} variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
          <RefreshCw className="w-4 h-4" />
          Start New Plan
        </Button>
        <Button 
          onClick={() => {
            if (navigator.share) {
              navigator.share({
                title: 'Supplme Hydration Guide',
                text: 'Check out my personalized hydration plan from Supplme',
                url: window.location.href
              }).catch(() => {});
            } else {
              navigator.clipboard.writeText(window.location.href);
              toast({ title: "Link Copied", description: "Share link copied to clipboard" });
            }
          }}
          variant="outline" 
          size="lg" 
          className="gap-2 w-full sm:w-auto"
        >
          <Share2 className="w-4 h-4" />
          Share
        </Button>
      </div>

      {/* GDPR Data Deletion */}
      <div className="flex justify-center pt-4">
        <Button 
          onClick={handleDeleteMyData} 
          variant="ghost" 
          size="sm" 
          className="text-muted-foreground hover:text-destructive text-xs"
        >
          Delete My Data (GDPR)
        </Button>
      </div>

      {/* Medical Disclaimer - Moved to bottom */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Medical & Professional Disclaimer</AlertTitle>
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
          <p className="font-semibold text-foreground">LEGAL DISCLAIMER</p>
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
