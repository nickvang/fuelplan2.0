import { useState, useEffect } from 'react';
import { HydrationPlan, HydrationProfile, AIEnhancedInsights } from '@/types/hydration';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Droplets, Clock, TrendingUp, AlertCircle, Sparkles, ExternalLink, Calculator, BookOpen, Shield, Download, RefreshCw, Share2, X, Loader2, Activity } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import supplmeLogo from '@/assets/supplme-logo.png';
import { jsPDF } from 'jspdf';

interface HydrationPlanDisplayProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
  onReset: () => void;
  onFullReset?: () => void;
  hasSmartWatchData?: boolean;
  rawSmartWatchData?: any;
  version?: 'simple' | 'pro';
}

export function HydrationPlanDisplay({ plan: initialPlan, profile: initialProfile, onReset, onFullReset, hasSmartWatchData = false, rawSmartWatchData, version }: HydrationPlanDisplayProps) {
  const [aiInsights, setAiInsights] = useState<AIEnhancedInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  
  // Extract initial distance from raceDistance string (e.g., "5 km" -> 5)
  const getInitialDistance = () => {
    if (initialProfile.raceDistance) {
      const raceText = initialProfile.raceDistance.toLowerCase();
      
      // Check for common race names first (ORDER MATTERS - check longer strings first!)
      const raceDistances: { [key: string]: number } = {
        // Triathlon distances - check "half ironman" BEFORE "ironman"
        'half ironman': 113, // 1.9km swim + 90km bike + 21.1km run
        'ironman 70.3': 113,
        '70.3': 113,
        'ironman': 226, // 3.8km swim + 180km bike + 42.2km run
        'full ironman': 226,
        '140.6': 226,
        'olympic': 51.5, // 1.5km swim + 40km bike + 10km run
        'olympic tri': 51.5,
        'sprint': 25.75, // 750m swim + 20km bike + 5km run
        'sprint tri': 25.75,
        
        // Running distances - ORDER MATTERS: check 'half marathon' BEFORE 'marathon'!
        'half marathon': 21.1,
        'marathon': 42.2,
        'ultra': 50,
        '50k': 50,
        '100k': 100,
        '100 mile': 160,
        '10k': 10,
        '5k': 5,
        
        // Cycling
        'century': 160,
        '100 miles': 160,
      };
      
      // Check if any race name matches
      for (const [raceName, distance] of Object.entries(raceDistances)) {
        if (raceText.includes(raceName)) {
          console.log('Matched race name:', raceName, 'to distance:', distance);
          return distance;
        }
      }
      
      // If no race name match, try to extract a number
      const match = initialProfile.raceDistance.match(/(\d+\.?\d*)/);
      const distance = match ? parseFloat(match[1]) : 5;
      console.log('Initial distance extracted:', distance, 'from', initialProfile.raceDistance);
      return distance;
    }
    console.log('No raceDistance found, defaulting to 5');
    return 5;
  };
  
  const [adjustedDistance, setAdjustedDistance] = useState(getInitialDistance());
  const [distanceInput, setDistanceInput] = useState(String(getInitialDistance()));
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [plan, setPlan] = useState(initialPlan);
  const [profile, setProfile] = useState(initialProfile);
  const { toast } = useToast();

  const handleDistanceChange = async (newDistance: number) => {
    console.log('handleDistanceChange called with:', newDistance);
    
    if (newDistance <= 0 || newDistance > 500) {
      console.log('Distance out of range, ignoring');
      return;
    }
    
    setIsRegenerating(true);
    setAdjustedDistance(newDistance);
    
    // Calculate new duration based on discipline and pace
    const getPaceInMinPerKm = () => {
      const discipline = profile.disciplines?.[0];
      
      // For cycling, use bike power or avgPace, default to 30 km/h
      if (discipline === 'Cycling' || discipline === 'Triathlon') {
        const paceStr = profile.bikePower || profile.avgPace;
        console.log('Cycling pace string found:', paceStr);
        if (paceStr) {
          // Check if it's speed (km/h)
          if (paceStr.includes('km/h')) {
            const match = paceStr.match(/(\d+\.?\d*)/);
            const speedKmH = match ? parseFloat(match[1]) : 30;
            const paceMinPerKm = 60 / speedKmH; // Convert speed to pace
            console.log('Parsed cycling speed:', speedKmH, 'km/h -> pace:', paceMinPerKm, 'min/km');
            return paceMinPerKm;
          }
          // If it's wattage, estimate 25 km/h average
          return 60 / 25; // ~2.4 min/km
        }
        console.log('No cycling pace found, using default 30 km/h (2 min/km)');
        return 60 / 30; // 2 min/km
      }
      
      // For running and other disciplines
      const paceStr = profile.runPace || profile.avgPace;
      console.log('Pace string found:', paceStr);
      if (paceStr) {
        const match = paceStr.match(/(\d+\.?\d*)/);
        const pace = match ? parseFloat(match[1]) : 6;
        console.log('Parsed pace:', pace);
        return pace;
      }
      console.log('No pace found, using default 6 min/km');
      return 6;
    };
    
    const paceMinPerKm = getPaceInMinPerKm();
    let newDuration = (newDistance * paceMinPerKm) / 60;
    
    // Ensure minimum duration is 0.5 hours to pass validation
    if (newDuration < 0.5) {
      console.log('Duration too short:', newDuration, 'setting to minimum 0.5 hours');
      newDuration = 0.5;
    }
    
    console.log('Calculated new duration:', newDuration, 'hours for', newDistance, 'km at', paceMinPerKm, 'min/km');
    
    const updatedProfile = { 
      ...profile, 
      sessionDuration: newDuration,
      raceDistance: `${newDistance} km`
    };
    setProfile(updatedProfile);
    
    // Recalculate plan with new duration
    const newPlan = calculateHydrationPlan(updatedProfile, rawSmartWatchData);
    console.log('New plan calculated:', newPlan);
    setPlan(newPlan);
    
    // Fetch AI insights for the new plan
    try {
      const { data, error } = await supabase.functions.invoke('enhance-hydration-plan', {
        body: { 
          plan: newPlan,
          profile: updatedProfile
        }
      });

      if (error) throw error;
      if (data?.insights) {
        setAiInsights(data.insights);
      }
      
      toast({
        title: "Plan Updated",
        description: `Recalculated for ${newDistance} km (${newDuration.toFixed(1)} hours at ${paceMinPerKm} min/km pace)`,
      });
    } catch (error) {
      console.error('Error fetching AI insights:', error);
      toast({
        title: "Plan Updated",
        description: `Recalculated for ${newDistance} km (${newDuration.toFixed(1)} hours)`,
      });
    } finally {
      setIsRegenerating(false);
    }
  };

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
      const doc = new jsPDF();
      const W = doc.internal.pageSize.width;
      const H = doc.internal.pageSize.height;
      const M = 15; // margin
      let y = 20;

      const checkPage = (space: number = 30) => {
        if (y + space > H - 20) {
          doc.addPage();
          y = 20;
        }
      };

      const addText = (text: string, size: number, bold: boolean = false, color: number[] = [0, 0, 0]) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, W - 2 * M);
        lines.forEach((line: string) => {
          checkPage();
          doc.text(line, M, y);
          y += size * 0.5;
        });
      };

      // ==== HEADER ====
      doc.setFillColor(250, 250, 250);
      doc.rect(0, 0, W, 40, 'F');
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('SUPPLME', M, 20);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Your Elite Hydration Strategy', M, 30);
      y = 50;

      // ==== USER INFO ====
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(profile.fullName || 'Athlete', M, y);
      y += 6;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text((profile.disciplines || []).join(', '), M, y);
      y += 4;
      doc.text(new Date().toLocaleString(), M, y);
      y += 15;

      // ==== SMARTWATCH DATA ALERT ====
      if (hasSmartWatchData) {
        checkPage(25);
        doc.setFillColor(240, 248, 255);
        doc.rect(M, y, W - 2 * M, 20, 'F');
        y += 7;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('⚡ Performance Optimized with Your Metrics', M + 3, y);
        y += 6;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 100, 100);
        addText('This plan leverages your physiological data, sleep patterns, activity history, and recovery metrics for elite-level accuracy.', 8, false, [100, 100, 100]);
        y += 10;
      }

      // ==== FLUID LOSS CARD ====
      checkPage(50);
      doc.setFillColor(250, 250, 250);
      doc.rect(M, y, W - 2 * M, 45, 'F');
      y += 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(120, 120, 120);
      doc.text('TOTAL FLUID LOSS', W / 2, y, { align: 'center' });
      y += 15;
      doc.setFontSize(36);
      doc.setTextColor(0, 0, 0);
      const liters = (plan.totalFluidLoss / 1000).toFixed(1);
      doc.text(`${liters} L`, W / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const dur = profile.sessionDuration < 1 ? `${Math.round(profile.sessionDuration * 60)} minute` : `${profile.sessionDuration.toFixed(1)} hour`;
      doc.text(`during your ${dur} ${profile.disciplines?.[0] || 'activity'}`, W / 2, y, { align: 'center' });
      y += 20;

      // ==== PERFORMANCE PROTOCOL HEADER ====
      checkPage(30);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('YOUR PERFORMANCE PROTOCOL', W / 2, y, { align: 'center' });
      y += 8;
      if (profile.raceDistance) {
        doc.setFontSize(14);
        doc.text(`${adjustedDistance} KM`, W / 2, y, { align: 'center' });
        y += 6;
      }
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text(`${profile.sessionDuration.toFixed(1)} Hour ${profile.disciplines?.[0] || 'Activity'} Session`, W / 2, y, { align: 'center' });
      y += 15;

      // ==== THREE PHASE PLAN ====
      checkPage(120);
      const cardW = (W - 2 * M - 10) / 3;
      const cardH = 85;
      
      // PRE
      doc.setFillColor(245, 245, 245);
      doc.rect(M, y, cardW, cardH, 'F');
      let cardY = y + 10;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(plan.preActivity.timing, M + 5, cardY);
      cardY += 10;
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('PRE', M + 5, cardY);
      cardY += 15;
      doc.setFillColor(255, 255, 255);
      doc.rect(M + 5, cardY, cardW - 10, 16, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Water', M + 8, cardY);
      cardY += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`${plan.preActivity.water} ml`, M + 8, cardY);
      cardY += 12;
      doc.setFillColor(255, 255, 255);
      doc.rect(M + 5, cardY, cardW - 10, 16, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Supplme Sachet', M + 8, cardY);
      cardY += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${plan.preActivity.electrolytes}x`, M + 8, cardY);

      // DURING
      let x2 = M + cardW + 5;
      doc.setFillColor(30, 30, 30);
      doc.rect(x2, y, cardW, cardH, 'F');
      cardY = y + 10;
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text(plan.duringActivity.frequency, x2 + 5, cardY);
      cardY += 10;
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('DURING', x2 + 5, cardY);
      cardY += 15;
      doc.setFillColor(60, 60, 60);
      doc.rect(x2 + 5, cardY, cardW - 10, 16, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 180, 180);
      doc.text('Per Hour', x2 + 8, cardY);
      cardY += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(`${plan.duringActivity.waterPerHour} ml`, x2 + 8, cardY);
      cardY += 12;
      doc.setFillColor(60, 60, 60);
      doc.rect(x2 + 5, cardY, cardW - 10, 16, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 180, 180);
      doc.text('Supplme / Hour', x2 + 8, cardY);
      cardY += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${plan.duringActivity.electrolytesPerHour}x`, x2 + 8, cardY);

      // POST
      let x3 = M + 2 * cardW + 10;
      doc.setFillColor(245, 245, 245);
      doc.rect(x3, y, cardW, cardH, 'F');
      cardY = y + 10;
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(plan.postActivity.timing, x3 + 5, cardY);
      cardY += 10;
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('POST', x3 + 5, cardY);
      cardY += 15;
      doc.setFillColor(255, 255, 255);
      doc.rect(x3 + 5, cardY, cardW - 10, 16, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Recovery Water', x3 + 8, cardY);
      cardY += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`${plan.postActivity.water} ml`, x3 + 8, cardY);
      cardY += 12;
      doc.setFillColor(255, 255, 255);
      doc.rect(x3 + 5, cardY, cardW - 10, 16, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('Supplme Sachet', x3 + 8, cardY);
      cardY += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`${plan.postActivity.electrolytes}x`, x3 + 8, cardY);

      y += cardH + 20;

      // ==== WHY SO MANY SACHETS? ====
      checkPage(55);
      doc.setFillColor(240, 250, 255);
      doc.rect(M, y, W - 2 * M, 50, 'F');
      doc.setDrawColor(0, 148, 255);
      doc.setLineWidth(0.5);
      doc.line(M, y, M, y + 50);
      
      const explainerY = y + 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 148, 255);
      doc.text('Why this many sachets?', M + 5, explainerY);
      
      let textY = explainerY + 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      
      const explainerText1 = `Your body loses ${plan.totalFluidLoss ? plan.totalFluidLoss.toFixed(0) : 'approximately 1000'}ml of fluid during this session through sweat.${profile.avgPace && profile.raceDistance ? ` This is calculated from your ${profile.sessionDuration.toFixed(1)}-hour session duration (based on your ${profile.avgPace} pace over ${profile.raceDistance}).` : profile.sessionDuration ? ` This is based on your ${profile.sessionDuration.toFixed(1)}-hour session duration.` : ''} Each Supplme sachet contains the precise sodium, potassium, and magnesium ratios clinically proven to maximize fluid absorption up to 3x more effective than water alone.`;
      const explainerLines1 = doc.splitTextToSize(explainerText1, W - 2 * M - 10);
      doc.text(explainerLines1, M + 5, textY);
      textY += explainerLines1.length * 3.5 + 3;
      
      const explainerText2 = `The algorithm accounts for your sweat rate, temperature, intensity, and duration to calculate the exact electrolyte replacement needed to maintain performance and prevent cramping. This isn't guesswork—it's science-backed hydration optimized for your specific conditions.`;
      const explainerLines2 = doc.splitTextToSize(explainerText2, W - 2 * M - 10);
      doc.text(explainerLines2, M + 5, textY);
      textY += explainerLines2.length * 3.5 + 3;
      
      doc.setFont('helvetica', 'bold');
      const explainerText3 = `This formula has been tested and validated with numerous athletes to ensure optimal performance and safety.`;
      const explainerLines3 = doc.splitTextToSize(explainerText3, W - 2 * M - 10);
      doc.text(explainerLines3, M + 5, textY);
      
      y += 58;

      // ==== AI-ENHANCED ANALYSIS ====
      if (aiInsights && version === 'pro') {
        checkPage(100);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('AI-ENHANCED ANALYSIS', M, y);
        y += 3;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`${aiInsights.confidence_level.toUpperCase()} CONFIDENCE`, M, y);
        y += 10;

        if (aiInsights.personalized_insight) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Why These Numbers?', M, y);
          y += 5;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          addText(aiInsights.personalized_insight, 8, false);
          y += 5;
          
          // Add altitude info if present
          if (profile.altitudeMeters && profile.altitudeMeters > 1000) {
            checkPage(10);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(`Training Altitude: ${profile.altitudeMeters}m`, M, y);
            y += 4;
            doc.setFont('helvetica', 'normal');
            const altitudeImpact = profile.altitudeMeters > 2500 ? '15-20%' : '10-15%';
            addText(`Altitude increases respiratory water loss by ${altitudeImpact}. This has been factored into your hydration calculations.`, 8, false);
            y += 5;
          }
        }

        if (aiInsights.performance_comparison) {
          checkPage(25);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Performance Comparison', M, y);
          y += 5;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          addText(aiInsights.performance_comparison, 8, false);
          y += 5;
        }

        if (aiInsights.optimization_tips && aiInsights.optimization_tips.length > 0) {
          checkPage(30);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.text('Optimization Tips', M, y);
          y += 5;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          aiInsights.optimization_tips.forEach(tip => {
            checkPage();
            doc.text(`• ${tip}`, M + 3, y);
            y += 5;
          });
          y += 3;
        }

        if (aiInsights.risk_factors) {
          checkPage(20);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(150, 0, 0);
          doc.text('Key Risk Factors', M, y);
          y += 5;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(0, 0, 0);
          addText(aiInsights.risk_factors, 8, false);
          y += 5;
        }

        if (aiInsights.professional_recommendation) {
          checkPage(20);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          doc.text('Professional Recommendation', M, y);
          y += 5;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          addText(aiInsights.professional_recommendation, 8, false);
          y += 5;
        }

        y += 10;
      }

      // ==== RACE DAY STRATEGY ====
      if (profile.upcomingEvents) {
        checkPage(60);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('RACE DAY HYDRATION PLAN', M, y);
        y += 5;
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`For your upcoming: ${profile.upcomingEvents}`, M, y);
        y += 10;

        // Pre-Race
        doc.setFillColor(248, 248, 248);
        doc.rect(M, y, W - 2 * M, 24, 'F');
        y += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text('Pre-Race (Day Before & Morning)', M + 5, y);
        y += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`• Day before: Maintain hydration + ${plan.preActivity.water}ml extra`, M + 5, y);
        y += 4;
        doc.text(`• 2 hours before: ${plan.preActivity.water}ml water + ${plan.preActivity.electrolytes}x Supplme`, M + 5, y);
        y += 4;
        doc.text(`• 30 min before: 200-300ml water (sips only)`, M + 5, y);
        y += 10;

        // During Race
        doc.setFillColor(248, 248, 248);
        doc.rect(M, y, W - 2 * M, 18, 'F');
        y += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('During Race', M + 5, y);
        y += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`• Every 30-45 min: 1 Supplme sachet`, M + 5, y);
        y += 4;
        doc.text(`• Drink ${plan.duringActivity.waterPerHour}ml water per hour`, M + 5, y);
        y += 8;

        // Post-Race
        doc.setFillColor(248, 248, 248);
        doc.rect(M, y, W - 2 * M, 16, 'F');
        y += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Post-Race Recovery', M + 5, y);
        y += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`• Start immediately: ${plan.postActivity.electrolytes}x Supplme over 4-6 hours`, M + 5, y);
        y += 4;
        doc.text(`• Gradually: ${plan.postActivity.water}ml water over 4-6 hours`, M + 5, y);
        y += 12;
      }

      // ==== SUPPLME PRODUCT INFO ====
      checkPage(35);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Supplme Liquid Electrolyte', M, y);
      y += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      addText('Contains 1000mg sodium per 30ml sachet for optimal hydration during intense exercise. Pure, science-backed formula for maximum absorption.', 8, false);
      y += 3;
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      addText('Visit supplme.com to learn more and order', 7, false, [100, 100, 100]);
      y += 15;

      // ==== HOW IT WORKS ====
      checkPage(40);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Scientific Approach', M, y);
      y += 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      plan.calculationSteps.slice(0, 5).forEach((step, idx) => {
        checkPage(8);
        doc.text(`${idx + 1}. ${step}`, M + 3, y);
        y += 5;
      });
      y += 10;

      // ==== PERSONALIZED RECOMMENDATIONS ====
      checkPage(40);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Personalized Recommendations', M, y);
      y += 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      plan.recommendations.slice(0, 6).forEach(rec => {
        checkPage(8);
        doc.text(`• ${rec}`, M + 3, y);
        y += 5;
      });
      y += 10;

      // ==== SCIENTIFIC REFERENCES ====
      checkPage(25);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Scientific References', M, y);
      y += 7;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      addText('All recommendations based on peer reviewed research from PubMed, using evidence based guidelines from sports science, exercise physiology, and nutrition research.', 8, false);
      y += 10;

      // ==== FOOTER ====
      const footerY = H - 15;
      doc.setDrawColor(200, 200, 200);
      doc.line(M, footerY, W - M, footerY);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('SUPPLME', W / 2, footerY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Science-Backed Hydration & Absorption', W / 2, footerY + 9, { align: 'center' });

      const fileName = `supplme-guide-${profile.fullName?.replace(/\s+/g, '-').toLowerCase() || 'athlete'}-${Date.now()}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Downloaded",
        description: "Your complete hydration plan is ready.",
      });
    } catch (error) {
      console.error('PDF Error:', error);
      toast({
        title: "Download Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Epic Header - Achievement Unlocked Style */}
      <div className="relative overflow-hidden">
        {/* Background Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-chrome-light/20 via-transparent to-chrome-light/20 blur-3xl"></div>
        
        <div className="relative text-center space-y-2 py-2">
          {/* Logo with Glow */}
          <div className="relative inline-block">
            <div className="absolute inset-0 glow-effect blur-3xl opacity-40"></div>
            <img src={supplmeLogo} alt="Supplme" className="h-48 md:h-56 mx-auto relative z-10 performance-pulse" />
          </div>
          
          {/* Main Title - Athletic Energy */}
          <div className="space-y-3">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight uppercase text-foreground">
              YOUR ELITE PLAN
            </h1>
            <p className="text-xl font-semibold text-muted-foreground max-w-2xl mx-auto">
              Your Personalized Hydration Strategy
            </p>
          </div>
          
          {/* Smartwatch Data Badge - Athletic Style */}
          {hasSmartWatchData && (
            <div className="inline-flex items-center gap-2 athletic-card px-6 py-3 rounded-full bg-chrome/10">
              <Sparkles className="w-5 h-5 text-chrome-dark" />
              <span className="text-sm font-bold tracking-wide uppercase text-foreground">
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
      <Card className="athletic-card p-8 bg-gradient-to-br from-chrome/10 to-background border-chrome">
        <div className="text-center space-y-3">
          <p className="text-sm font-bold tracking-wider uppercase text-muted-foreground">Total Fluid Loss</p>
          <p className="text-6xl font-black text-foreground">
            {(() => {
              const liters = plan.totalFluidLoss / 1000;
              return liters < 0.5 ? liters.toFixed(2) : liters.toFixed(1);
            })()} L
          </p>
          <p className="text-base font-semibold text-muted-foreground">
            during your {profile.sessionDuration < 1 
              ? `${Math.round(profile.sessionDuration * 60)} minute` 
              : `${profile.sessionDuration.toFixed(1)} hour`} {profile.disciplines?.[0] || 'activity'}
          </p>
          {hasSmartWatchData && (
            <p className="text-sm font-semibold text-chrome-dark">
              ⚡ Calculated from your actual training data
            </p>
          )}
        </div>
      </Card>

      {/* Training Plan Header - Epic Style */}
      <div className="text-center py-6 space-y-4">
        <h2 className="text-3xl md:text-4xl font-black tracking-tight uppercase text-foreground">Your Performance Protocol</h2>
        {profile.raceDistance && (
          <div className="inline-block athletic-card px-8 py-4 rounded-2xl" style={{ backgroundColor: '#0a0a0a' }}>
            <p className="text-3xl font-black" style={{ color: '#ffffff' }}>
              {adjustedDistance} KM
            </p>
          </div>
        )}
        <p className="text-xl font-bold text-muted-foreground uppercase tracking-wide">
          {profile.sessionDuration.toFixed(1)} Hour {profile.disciplines?.[0] || 'Activity'} Session
        </p>
      </div>

      {/* Three Phase Plan - Simple High Contrast Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* PRE */}
        <Card className="athletic-card p-8 space-y-5 bg-card border-2 border-border">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider">{plan.preActivity.timing}</span>
            </div>
            <h3 className="text-5xl font-black text-foreground">PRE</h3>
          </div>
          
          <div className="space-y-4 py-4">
            <div className="bg-secondary p-4 rounded-xl border border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Water</p>
              <p className="text-3xl font-black text-foreground">{plan.preActivity.water} ml</p>
              <p className="text-xs font-semibold text-muted-foreground mt-2">Drink 2 hours before</p>
            </div>
            <div className="bg-secondary p-4 rounded-xl border border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Supplme Sachet (30ml)</p>
              <p className="text-3xl font-black text-foreground">{plan.preActivity.electrolytes}x</p>
            </div>
          </div>

          <p className="text-sm font-medium text-muted-foreground border-t border-border pt-4">
            ⚡ Prime your body with optimal fluid balance before you start
          </p>
        </Card>

        {/* DURING - Solid Black Background with White Text (Hidden for swimming races) */}
        {!(profile.disciplines?.includes('Swimming') && profile.hasUpcomingRace) && (
        <Card className="athletic-card p-8 space-y-5 border-4" style={{ backgroundColor: '#0a0a0a', borderColor: '#0a0a0a' }}>
          <div className="space-y-3">
            <div className="flex items-center gap-2" style={{ color: '#ffffff', opacity: 0.7 }}>
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider">{plan.duringActivity.frequency}</span>
            </div>
            <h3 className="text-5xl font-black" style={{ color: '#ffffff' }}>DURING</h3>
          </div>
          
          {/* Special note for indoor swimming training */}
          {profile.disciplines?.includes('Swimming') && !profile.hasUpcomingRace && profile.indoorOutdoor === 'indoor' && (
            <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
              <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>
                💧 <strong>Pool Training Tip:</strong> Keep a water bottle with {plan.duringActivity.electrolytesPerHour} Supplme sachet{plan.duringActivity.electrolytesPerHour > 1 ? 's' : ''} mixed in at the pool edge. Sip between sets during rest intervals.
              </p>
            </div>
          )}
          
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Water per hour</p>
              <p className="text-3xl font-black" style={{ color: '#ffffff' }}>
                {plan.duringActivity.waterPerHour > 0 
                  ? `${plan.duringActivity.waterPerHour} ml` 
                  : 'As needed'}
              </p>
              <p className="text-xs font-semibold mt-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Sip {plan.duringActivity.frequency.toLowerCase()}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Supplme per hour</p>
              <p className="text-3xl font-black" style={{ color: '#ffffff' }}>
                {plan.duringActivity.electrolytesPerHour > 0 
                  ? `${plan.duringActivity.electrolytesPerHour} sachet${plan.duringActivity.electrolytesPerHour > 1 ? 's' : ''}` 
                  : 'Not required'}
              </p>
              {plan.duringActivity.electrolytesPerHour > 0 && (() => {
                const totalSachets = Math.round(plan.duringActivity.electrolytesPerHour * profile.sessionDuration);
                const totalMinutes = profile.sessionDuration * 60;
                const minutesPerSachet = Math.round(totalMinutes / totalSachets);
                const sodiumPerHour = plan.duringActivity.electrolytesPerHour * 500;
                
                // All sachets now capped at 1/hour (500mg sodium)
                let intensityLabel = '';
                let intensityColor = 'rgba(255, 255, 255, 0.7)';
                if (sodiumPerHour >= 500) {
                  intensityLabel = 'Conservative: 500mg/h max';
                  intensityColor = 'rgba(255, 255, 255, 0.8)';
                } else if (sodiumPerHour >= 400) {
                  intensityLabel = 'Moderate intensity';
                  intensityColor = 'rgba(255, 255, 255, 0.75)';
                } else {
                  intensityLabel = 'Light intensity';
                  intensityColor = 'rgba(255, 255, 255, 0.7)';
                }
                
                return (
                  <>
                    <p className="text-xs font-semibold mt-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      1 every {minutesPerSachet} min
                    </p>
                    <p className="text-xs font-bold mt-1 pt-2 border-t border-white/20" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                      Total: {totalSachets} sachet{totalSachets > 1 ? 's' : ''} for {profile.sessionDuration}h
                    </p>
                    <p className="text-[10px] font-medium mt-1" style={{ color: intensityColor }}>
                      {sodiumPerHour}mg/h sodium • {intensityLabel}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          <div className="pt-4 space-y-2" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
            <p className="text-sm font-medium" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
              💧 Practical approach: Most runners carry minimal water
            </p>
            <p className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
              Sachets are easy to carry • Water recommendations match typical carrying capacity
            </p>
          </div>
        </Card>
        )}

        {/* POST */}
        <Card className="athletic-card p-8 space-y-5 bg-card border-2 border-border">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider">{plan.postActivity.timing}</span>
            </div>
            <h3 className="text-5xl font-black text-foreground">POST</h3>
          </div>
          
          <div className="space-y-4 py-4">
            <div className="bg-secondary p-4 rounded-xl border border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Water (150% of loss)</p>
              <p className="text-3xl font-black text-foreground">{plan.postActivity.water} ml</p>
              <p className="text-xs font-semibold text-muted-foreground mt-2">Over 4-6 hours</p>
            </div>
            <div className="bg-secondary p-4 rounded-xl border border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Supplme Sachet</p>
              <p className="text-3xl font-black text-foreground">{plan.postActivity.electrolytes}x</p>
              <p className="text-xs font-semibold text-muted-foreground mt-2">With water intake</p>
            </div>
          </div>

          <p className="text-sm font-medium text-muted-foreground border-t border-border pt-4">
            💪 Accelerate recovery and restore your body to peak condition
          </p>
        </Card>
      </div>

      {/* Why So Many Sachets? Explainer */}
      <Alert className="border-l-4 border-l-primary bg-primary/5">
        <Sparkles className="h-5 w-5 text-primary" />
        <AlertTitle className="text-lg font-bold mb-2">Why this many sachets?</AlertTitle>
        <AlertDescription className="text-muted-foreground space-y-2">
          <p className="leading-relaxed">
            Your body loses <strong>{plan.totalFluidLoss ? plan.totalFluidLoss.toFixed(0) : 'approximately 1000'}ml of fluid</strong> during this session through sweat. 
            {profile.avgPace && profile.raceDistance && (
              <> This is calculated from your <strong>{profile.sessionDuration.toFixed(1)}-hour session</strong> duration (based on your {profile.avgPace} pace over {profile.raceDistance}).</>
            )}
            {!profile.avgPace && profile.sessionDuration && (
              <> This is based on your <strong>{profile.sessionDuration.toFixed(1)}-hour session</strong> duration.</>
            )}
            {' '}Each Supplme sachet contains the precise sodium, potassium, and magnesium ratios clinically proven to maximize fluid absorption up to 3x more effective than water alone.
          </p>
          <p className="leading-relaxed">
            The algorithm accounts for your sweat rate, temperature, intensity, and duration to calculate the exact electrolyte replacement needed to maintain performance and prevent cramping. 
            This isn't guesswork—it's science-backed hydration optimized for your specific conditions.
          </p>
          <p className="leading-relaxed font-semibold">
            This formula has been tested and validated with numerous athletes to ensure optimal performance and safety.
          </p>
          {version === 'simple' && (
            <p className="leading-relaxed text-primary font-semibold pt-2 border-t border-primary/20 mt-3">
              💡 Want even more precision? Take our <strong>Pro/Advanced version</strong> for detailed environmental and physiological customization, or <strong>upload data from your smartwatch/device</strong> for AI-powered insights based on your actual recovery and performance metrics.
            </p>
          )}
        </AlertDescription>
      </Alert>

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
              <div className="relative md:grid md:grid-cols-2 md:gap-12 items-center">
                <div className="hidden md:block" />
                <Card className="relative p-6 space-y-4 border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-lg">
                  <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground hidden md:flex">
                    1
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">📅</span>
                    <div>
                      <h3 className="text-2xl font-black uppercase">Day Before</h3>
                      <p className="text-sm text-muted-foreground font-semibold">T-24 Hours</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-background to-muted border border-border">
                      <div className="text-3xl mb-2">💧</div>
                      <p className="text-xs font-bold text-primary uppercase">Hydrate</p>
                      <p className="text-2xl font-black">2-3L</p>
                      <p className="text-xs text-muted-foreground">Throughout day</p>
                    </div>
                    <div className="p-4 rounded-lg bg-gradient-to-br from-background to-muted border border-border">
                      <div className="text-3xl mb-2">⚡</div>
                      <p className="text-xs font-bold text-primary uppercase">Evening</p>
                      <p className="text-2xl font-black">500ml</p>
                      <p className="text-xs text-muted-foreground">+ 1x Supplme</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm font-semibold text-foreground">🚫 Avoid: Alcohol • New foods • Late caffeine</p>
                  </div>
                </Card>
              </div>

              {/* Race Morning - Left Side */}
              <div className="relative md:grid md:grid-cols-2 md:gap-12 items-center">
                <Card className="relative p-6 space-y-4 border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-lg">
                  <div className="absolute -right-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground hidden md:flex">
                    2
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">🌅</span>
                    <div>
                      <h3 className="text-2xl font-black uppercase">Race Morning</h3>
                      <p className="text-sm text-muted-foreground font-semibold">T-3 Hours</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/20 to-background border-l-4 border-primary">
                      <span className="text-2xl font-black text-primary">-3h</span>
                      <div>
                        <p className="text-sm font-bold">{plan.preActivity.water}ml + Breakfast</p>
                        <p className="text-xs text-muted-foreground">Wake up hydration</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/20 to-background border-l-4 border-primary">
                      <span className="text-2xl font-black text-primary">-2h</span>
                      <div>
                        <p className="text-sm font-bold">{plan.preActivity.electrolytes}x Supplme + 300ml</p>
                        <p className="text-xs text-muted-foreground">Last substantial intake</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/20 to-background border-l-4 border-primary">
                      <span className="text-2xl font-black text-primary">-30m</span>
                      <div>
                        <p className="text-sm font-bold">Small sips only (100-150ml)</p>
                        <p className="text-xs text-muted-foreground">Final bathroom break</p>
                      </div>
                    </div>
                  </div>
                </Card>
                <div className="hidden md:block" />
              </div>

              {/* During Race - Right Side (Hidden for swimming races) */}
              {!(profile.disciplines?.includes('Swimming')) && (
              <div className="relative md:grid md:grid-cols-2 md:gap-12 items-center">
                <div className="hidden md:block" />
                <Card className="relative p-6 space-y-4 border-4 border-primary shadow-xl" style={{ backgroundColor: '#0a0a0a' }}>
                  <div className="absolute -left-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground hidden md:flex">
                    3
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">🏁</span>
                    <div>
                      <h3 className="text-2xl font-black uppercase" style={{ color: '#ffffff' }}>During Race</h3>
                      <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Execute the plan</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-5 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Water per hour</p>
                      <p className="text-4xl font-black mb-1" style={{ color: '#ffffff' }}>{plan.duringActivity.waterPerHour}ml</p>
                      <p className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>Sip {plan.duringActivity.frequency.toLowerCase()}</p>
                    </div>
                    <div className="p-5 rounded-xl text-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)', border: '2px solid rgba(255,255,255,0.2)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255,255,255,0.6)' }}>Supplme per hour</p>
                      <p className="text-4xl font-black mb-1" style={{ color: '#ffffff' }}>{plan.duringActivity.electrolytesPerHour} sachet{plan.duringActivity.electrolytesPerHour > 1 ? 's' : ''}</p>
                      {(() => {
                        const totalSachets = Math.round(plan.duringActivity.electrolytesPerHour * profile.sessionDuration);
                        const totalMinutes = profile.sessionDuration * 60;
                        const minutesPerSachet = Math.round(totalMinutes / totalSachets);
                        const sodiumPerHour = plan.duringActivity.electrolytesPerHour * 500;
                        
                        return (
                          <>
                            <p className="text-xs font-semibold mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              1 every {minutesPerSachet} min
                            </p>
                            <p className="text-xs font-bold pt-2 border-t border-white/20" style={{ color: 'rgba(255,255,255,0.9)' }}>
                              {totalSachets} total ({sodiumPerHour}mg/h)
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/20 border border-primary/30">
                    <Activity className="w-5 h-5 text-primary" />
                    <p className="text-xs font-semibold text-primary-foreground">
                      Listen to your body • Adjust as needed
                    </p>
                  </div>
                </Card>
              </div>
              )}

              {/* Post Race - Left Side */}
              <div className="relative md:grid md:grid-cols-2 md:gap-12 items-center">
                <Card className="relative p-6 space-y-4 border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-lg">
                  <div className="absolute -right-6 top-1/2 transform -translate-y-1/2 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-2xl font-black text-primary-foreground hidden md:flex">
                    4
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-4xl">🎯</span>
                    <div>
                      <h3 className="text-2xl font-black uppercase">Recovery</h3>
                      <p className="text-sm text-muted-foreground font-semibold">4-6 Hour Window</p>
                    </div>
                  </div>
                  
                  <div className="relative pt-4">
                    <div className="space-y-4">
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-black text-primary-foreground">0h</div>
                          <div className="w-0.5 h-12 bg-primary/30"></div>
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="font-bold text-sm">Immediate</p>
                          <p className="text-xs text-muted-foreground">500ml + {plan.postActivity.electrolytes}x Supplme</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-primary/70 flex items-center justify-center text-xs font-black text-primary-foreground">2h</div>
                          <div className="w-0.5 h-12 bg-primary/30"></div>
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="font-bold text-sm">First Phase</p>
                          <p className="text-xs text-muted-foreground">{Math.round(plan.postActivity.water * 0.5)}ml + protein meal</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 rounded-full bg-primary/40 flex items-center justify-center text-xs font-black text-primary-foreground">6h</div>
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm">Complete</p>
                          <p className="text-xs text-muted-foreground">{plan.postActivity.water}ml total (150% loss)</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm font-semibold text-foreground">✓ Target: Pale yellow urine by evening</p>
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
              <p>✓ Pack {Math.ceil(plan.duringActivity.electrolytesPerHour * profile.sessionDuration)}x Supplme sachets</p>
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
                              {plan.totalFluidLoss ? plan.totalFluidLoss.toFixed(0) : 'N/A'}ml
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
                        {plan.totalFluidLoss && profile.sessionDuration ? (
                          profile.sweatRate === 'high' && profile.sweatSaltiness === 'high' 
                            ? `⚡ You lose significantly more sodium and fluid than the average athlete. Your estimated ${plan.totalFluidLoss.toFixed(0)}ml total fluid loss, combined with elevated sweat sodium, requires aggressive electrolyte replacement throughout your ${profile.sessionDuration.toFixed(1)} hour session. Without adequate replacement, you risk hyponatremia, cramping, and performance decline.`
                            : profile.sweatRate === 'high'
                            ? `⚡ Your elevated sweat rate means you'll lose approximately ${plan.totalFluidLoss.toFixed(0)}ml during this ${profile.sessionDuration.toFixed(1)} hour session, which is above average. Precise timing is critical: consume ${plan.duringActivity.waterPerHour}ml/hr with electrolytes ${plan.duringActivity.frequency.toLowerCase()} to maintain performance.`
                            : profile.sweatSaltiness === 'high'
                            ? `⚡ Your sweat has elevated sodium concentration, increasing cramping risk. While your fluid loss (${plan.totalFluidLoss.toFixed(0)}ml) is normal, each liter contains more sodium. The ${plan.duringActivity.electrolytesPerHour} Supplme sachets/hr provide precise electrolyte ratios to maintain neuromuscular function.`
                            : `✓ Your balanced profile allows standard evidence based protocols. Your ${plan.totalFluidLoss.toFixed(0)}ml total fluid loss over ${profile.sessionDuration.toFixed(1)} hours means you're losing approximately ${Math.round(plan.totalFluidLoss / profile.sessionDuration)}ml per hour, which is within the normal range for endurance athletes (600 to 1000ml/hr). This moderate sweat rate, combined with your medium sodium loss, means 1 sachet per hour provides optimal electrolyte replacement. Your hydration needs align with ACSM guidelines, adjusted for your environmental conditions.`
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
                      <span className="text-2xl">⚡</span>
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
                            <span className="text-xl">🎯</span>
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

      {/* Distance Adjustment Tool */}
      <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Adjust Distance</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {profile.disciplines?.[0] === 'Triathlon' 
              ? 'Enter total race distance to recalculate (swim + bike + run combined)'
              : profile.disciplines?.[0] === 'Cycling'
              ? 'Enter cycling distance to recalculate (duration based on your cycling speed)'
              : 'Enter a new distance to recalculate your hydration plan (duration calculated from your pace)'}
          </p>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="distance-adjust" className="text-sm font-medium">
                {profile.disciplines?.[0] === 'Triathlon' 
                  ? 'Total Race Distance (km)'
                  : profile.disciplines?.[0] === 'Cycling'
                  ? 'Cycling Distance (km)'
                  : 'Distance (km)'}
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="distance-adjust"
                  type="number"
                  min="1"
                  max="500"
                  step="1"
                  value={distanceInput}
                  onChange={(e) => setDistanceInput(e.target.value)}
                  placeholder="Enter distance"
                  className="text-2xl font-bold text-center w-32 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  disabled={isRegenerating}
                />
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      const current = parseFloat(distanceInput) || 0;
                      setDistanceInput(String(Math.min(500, current + 1)));
                    }}
                    disabled={isRegenerating}
                  >
                    ▲
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      const current = parseFloat(distanceInput) || 0;
                      setDistanceInput(String(Math.max(1, current - 1)));
                    }}
                    disabled={isRegenerating}
                  >
                    ▼
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 shrink-0"
                  onClick={() => setDistanceInput('')}
                  disabled={isRegenerating || !distanceInput}
                >
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>
            </div>
            
            {/* Quick Distance Presets */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Quick Presets:</Label>
              <div className="flex flex-wrap gap-2">
                {profile.disciplines?.[0] === 'Triathlon' ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('25.75'); handleDistanceChange(25.75); }} disabled={isRegenerating}>
                      Sprint (25.75km)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('51.5'); handleDistanceChange(51.5); }} disabled={isRegenerating}>
                      Olympic (51.5km)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('113'); handleDistanceChange(113); }} disabled={isRegenerating}>
                      Half Ironman (113km)
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('226'); handleDistanceChange(226); }} disabled={isRegenerating}>
                      Ironman (226km)
                    </Button>
                  </>
                ) : profile.disciplines?.[0] === 'Cycling' ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('40'); handleDistanceChange(40); }} disabled={isRegenerating}>
                      40km
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('80'); handleDistanceChange(80); }} disabled={isRegenerating}>
                      80km
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('100'); handleDistanceChange(100); }} disabled={isRegenerating}>
                      100km
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('160'); handleDistanceChange(160); }} disabled={isRegenerating}>
                      Century (160km)
                    </Button>
                  </>
                ) : profile.disciplines?.[0] === 'Running' ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('5'); handleDistanceChange(5); }} disabled={isRegenerating}>
                      5K
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('10'); handleDistanceChange(10); }} disabled={isRegenerating}>
                      10K
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('21.1'); handleDistanceChange(21.1); }} disabled={isRegenerating}>
                      Half Marathon
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('42.2'); handleDistanceChange(42.2); }} disabled={isRegenerating}>
                      Marathon
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setDistanceInput('50'); handleDistanceChange(50); }} disabled={isRegenerating}>
                      50K Ultra
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="default"
                size="lg"
                className="flex-1 gap-2"
                onClick={() => {
                  if (distanceInput && parseFloat(distanceInput) > 0 && parseFloat(distanceInput) <= 500) {
                    handleDistanceChange(parseFloat(distanceInput));
                  } else {
                    toast({
                      title: "Invalid distance",
                      description: "Please enter a distance between 1 and 500 km",
                      variant: "destructive"
                    });
                  }
                }}
                disabled={!distanceInput || parseFloat(distanceInput) <= 0 || isRegenerating}
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    Re-calculate
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={() => {
                  const initial = getInitialDistance();
                  setDistanceInput(String(initial));
                  handleDistanceChange(initial);
                }}
                disabled={isRegenerating}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>
      </Card>

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
        <Button onClick={downloadPDF} variant="default" size="lg" className="gap-2">
          <Download className="w-4 h-4" />
          Download Plan
        </Button>
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
                  <div className="space-y-3">
                    <p className="text-sm font-medium">For Triathlon:</p>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Swim:</strong> Pre-loaded from pre-race sachet</li>
                      <li>• <strong>T1 Transition:</strong> Take 1 Supplme sachet</li>
                      <li>• <strong>Bike:</strong> 1 sachet every 45-60 minutes{plan.duringActivity.waterPerHour > 0 ? ` + ${Math.round(plan.duringActivity.waterPerHour * 0.85)}ml water/hour` : ''}</li>
                      <li>• <strong>T2 Transition:</strong> Take 1 Supplme sachet</li>
                      <li>• <strong>Run:</strong> 1 sachet every 30-45 minutes at aid stations + water as tolerated</li>
                    </ul>
                  </div>
                ) : profile.disciplines?.[0] === 'Run' ? (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>{plan.duringActivity.frequency}:</strong> Supplme sachet at aid station</li>
                    {plan.duringActivity.waterPerHour > 0 && (
                      <li>• Drink {Math.round(plan.duringActivity.waterPerHour / 2)}ml water every 15 minutes</li>
                    )}
                    <li>• For marathons: Aim for {Math.round(plan.duringActivity.electrolytesPerHour * (profile.sessionDuration || 3.5))} sachets total during race</li>
                    <li>• For ultras: {plan.duringActivity.electrolytesPerHour} sachet(s) per hour minimum</li>
                  </ul>
                ) : profile.disciplines?.[0] === 'Bike' ? (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>{plan.duringActivity.frequency}:</strong> Supplme sachet</li>
                    {plan.duringActivity.waterPerHour > 0 && (
                      <li>• Drink {plan.duringActivity.waterPerHour}ml water per hour in small sips</li>
                    )}
                    <li>• Keep sachets in jersey pocket or bike bag for easy access</li>
                  </ul>
                ) : profile.disciplines?.[0] === 'Football' ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">For Football (Soccer):</p>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Pre-Match:</strong> {plan.preActivity.water}ml water + {plan.preActivity.electrolytes}x Supplme sachet ({plan.preActivity.timing})</li>
                      <li>• <strong>Half-Time:</strong> 1 Supplme sachet + {Math.round(plan.duringActivity.waterPerHour / 2)}ml water</li>
                      <li>• <strong>Post-Match:</strong> {plan.postActivity.water}ml water + {plan.postActivity.electrolytes}x Supplme sachet ({plan.postActivity.timing})</li>
                    </ul>
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>{plan.duringActivity.frequency}:</strong> Supplme sachet</li>
                    {plan.duringActivity.waterPerHour > 0 && (
                      <li>• Drink {plan.duringActivity.waterPerHour}ml water per hour</li>
                    )}
                    <li>• Adjust based on aid station availability</li>
                  </ul>
                )}
              </div>

              <div className="bg-background p-4 rounded-lg">
                <h4 className="font-semibold mb-3">Post-Race Recovery</h4>
                <ul className="space-y-2 text-sm">
                  <li>• <strong>{plan.postActivity.timing}:</strong> {plan.postActivity.water}ml water + <strong>{plan.postActivity.electrolytes}x Supplme sachet(s)</strong></li>
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
