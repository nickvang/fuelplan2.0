import { useState, useEffect } from 'react';
import { HydrationPlan, HydrationProfile, AIEnhancedInsights } from '@/types/hydration';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Droplets, Clock, TrendingUp, AlertCircle, Sparkles, ExternalLink, Calculator, BookOpen, Shield, Download, RefreshCw, Share2, X, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
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
}

export function HydrationPlanDisplay({ plan: initialPlan, profile: initialProfile, onReset, onFullReset, hasSmartWatchData = false, rawSmartWatchData }: HydrationPlanDisplayProps) {
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
        
        // Running distances
        'marathon': 42.2,
        'half marathon': 21.1,
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
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;
      let y = 0;

      // SUPPLME Brand Colors - Scandinavian Palette
      const colors = {
        charcoal: [44, 44, 44] as [number, number, number],
        electricBlue: [0, 163, 224] as [number, number, number],
        coolGray: [240, 242, 245] as [number, number, number],
        mediumGray: [140, 145, 150] as [number, number, number],
        white: [255, 255, 255] as [number, number, number],
        paleBlue: [235, 248, 255] as [number, number, number]
      };

      // Helper: Check page break
      const checkPageBreak = (neededSpace: number = 40) => {
        if (y + neededSpace > pageHeight - 25) {
          doc.addPage();
          y = 20;
          return true;
        }
        return false;
      };

      // Helper: Add separator line
      const addSeparatorLine = () => {
        doc.setDrawColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;
      };

      // Helper: Add wrapped text
      const addWrappedText = (text: string, x: number, maxWidth: number, fontSize: number = 9, color: [number, number, number] = colors.charcoal, lineHeight: number = 1.4) => {
        doc.setFontSize(fontSize);
        doc.setTextColor(color[0], color[1], color[2]);
        const lines = doc.splitTextToSize(text, maxWidth);
        lines.forEach((line: string) => {
          checkPageBreak(10);
          doc.text(line, x, y);
          y += fontSize * 0.35 * lineHeight;
        });
      };

      // ========== HEADER: Clean, Minimal, Premium ==========
      y = 0;
      doc.setFillColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.rect(0, 0, pageWidth, 50, 'F');
      
      // SUPPLME Logo Text
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text('SUPPLME', margin, 22);
      
      // Tagline
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
      doc.text('Science-Backed Hydration & Absorption', margin, 32);

      // Smartwatch Badge (Top Right) - Only if data was used
      if (hasSmartWatchData) {
        const badgeX = pageWidth - margin - 60;
        const badgeY = 13;
        const badgeWidth = 58;
        const badgeHeight = 20;
        
        // Badge background
        doc.setFillColor(235, 248, 255);
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3, 3, 'F');
        
        // Badge border
        doc.setDrawColor(colors.electricBlue[0], colors.electricBlue[1], colors.electricBlue[2]);
        doc.setLineWidth(0.5);
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 3, 3, 'S');
        
        // Badge checkmark
        doc.setTextColor(colors.electricBlue[0], colors.electricBlue[1], colors.electricBlue[2]);
        doc.setFontSize(10);
        doc.text('✓', badgeX + 3, badgeY + 8);
        
        // Badge text
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.text('SMARTWATCH', badgeX + 9, badgeY + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.text('Enhanced Plan', badgeX + 9, badgeY + 11);
        doc.setTextColor(100, 100, 100);
        doc.text('Live Data', badgeX + 9, badgeY + 15.5);
      }

      y = 58;

      // ========== ATHLETE INFO BAR ==========
      doc.setFillColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
      doc.rect(margin, y, pageWidth - 2 * margin, 24, 'F');
      
      y += 8;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text('ATHLETE', margin + 5, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.text(profile.fullName || 'N/A', margin + 5, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text('DISCIPLINE', pageWidth / 2 - 10, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.text((profile.disciplines || []).join(', ') || 'N/A', pageWidth / 2 - 10, y + 5);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      const dateText = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      doc.text('DATE', pageWidth - margin - 40, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.text(dateText, pageWidth - margin - 40, y + 5);
      
      y += 22;

      // ========== KEY METRIC: FLUID LOSS ==========
      checkPageBreak(55);
      
      doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.setDrawColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
      doc.setLineWidth(0.5);
      doc.rect(margin, y, pageWidth - 2 * margin, 48, 'FD');
      
      y += 10;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text('TOTAL FLUID LOSS', pageWidth / 2, y, { align: 'center' });
      
      y += 16;
      doc.setFontSize(38);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      const liters = ((plan.totalFluidLoss || 0) / 1000).toFixed(1);
      doc.text(`${liters} L`, pageWidth / 2, y, { align: 'center' });
      
      y += 10;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      const durationText = profile.sessionDuration < 1 
        ? `${Math.round(profile.sessionDuration * 60)}-minute` 
        : `${profile.sessionDuration.toFixed(1)}-hour`;
      doc.text(`${durationText} ${(profile.disciplines || [])[0] || 'activity'} session`, pageWidth / 2, y, { align: 'center' });
      
      y += 18;

      // ========== PERFORMANCE PROTOCOL HEADER ==========
      checkPageBreak(45);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.text('PERFORMANCE PROTOCOL', pageWidth / 2, y, { align: 'center' });
      
      y += 3;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.electricBlue[0], colors.electricBlue[1], colors.electricBlue[2]);
      doc.text('PRE  •  DURING  •  POST', pageWidth / 2, y, { align: 'center' });
      
      y += 12;

      // ========== THREE-PHASE GRID ==========
      const cardWidth = (pageWidth - 2 * margin - 10) / 3;
      const cardHeight = 65;
      
      checkPageBreak(cardHeight + 10);
      
      // PRE Card
      let cardX = margin;
      doc.setFillColor(colors.paleBlue[0], colors.paleBlue[1], colors.paleBlue[2]);
      doc.rect(cardX, y, cardWidth, cardHeight, 'F');
      doc.setDrawColor(colors.electricBlue[0], colors.electricBlue[1], colors.electricBlue[2]);
      doc.setLineWidth(0.3);
      doc.rect(cardX, y, cardWidth, cardHeight, 'S');
      
      let cardY = y + 8;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text(plan.preActivity.timing.toUpperCase(), cardX + 5, cardY);
      
      cardY += 8;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.text('PRE', cardX + 5, cardY);
      
      cardY += 12;
      doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.roundedRect(cardX + 5, cardY, cardWidth - 10, 14, 2, 2, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text('Water', cardX + 8, cardY);
      cardY += 5;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.text(`${plan.preActivity.water} ml`, cardX + 8, cardY);
      
      cardY += 10;
      doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.roundedRect(cardX + 5, cardY, cardWidth - 10, 14, 2, 2, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text('Supplme Sachets', cardX + 8, cardY);
      cardY += 5;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.electricBlue[0], colors.electricBlue[1], colors.electricBlue[2]);
      doc.text(`${plan.preActivity.electrolytes}×`, cardX + 8, cardY);

      // DURING Card
      cardX = margin + cardWidth + 5;
      cardY = y;
      doc.setFillColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.rect(cardX, cardY, cardWidth, cardHeight, 'F');
      
      cardY += 8;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
      doc.text(plan.duringActivity.frequency.toUpperCase(), cardX + 5, cardY);
      
      cardY += 8;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.text('DURING', cardX + 5, cardY);
      
      cardY += 12;
      doc.setFillColor(60, 60, 60);
      doc.roundedRect(cardX + 5, cardY, cardWidth - 10, 14, 2, 2, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
      doc.text('Per Hour', cardX + 8, cardY);
      cardY += 5;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.text(`${plan.duringActivity.waterPerHour || 0} ml`, cardX + 8, cardY);
      
      cardY += 10;
      doc.setFillColor(60, 60, 60);
      doc.roundedRect(cardX + 5, cardY, cardWidth - 10, 14, 2, 2, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
      doc.text('Supplme / Hour', cardX + 8, cardY);
      cardY += 5;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.electricBlue[0], colors.electricBlue[1], colors.electricBlue[2]);
      doc.text(`${plan.duringActivity.electrolytesPerHour || 0}×`, cardX + 8, cardY);

      // POST Card
      cardX = margin + 2 * cardWidth + 10;
      cardY = y;
      doc.setFillColor(colors.paleBlue[0], colors.paleBlue[1], colors.paleBlue[2]);
      doc.rect(cardX, cardY, cardWidth, cardHeight, 'F');
      doc.setDrawColor(colors.electricBlue[0], colors.electricBlue[1], colors.electricBlue[2]);
      doc.setLineWidth(0.3);
      doc.rect(cardX, cardY, cardWidth, cardHeight, 'S');
      
      cardY += 8;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text(plan.postActivity.timing.toUpperCase(), cardX + 5, cardY);
      
      cardY += 8;
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.text('POST', cardX + 5, cardY);
      
      cardY += 12;
      doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.roundedRect(cardX + 5, cardY, cardWidth - 10, 14, 2, 2, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text('Recovery Water', cardX + 8, cardY);
      cardY += 5;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.text(`${plan.postActivity.water} ml`, cardX + 8, cardY);
      
      cardY += 10;
      doc.setFillColor(colors.white[0], colors.white[1], colors.white[2]);
      doc.roundedRect(cardX + 5, cardY, cardWidth - 10, 14, 2, 2, 'F');
      cardY += 5;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text('Supplme Sachets', cardX + 8, cardY);
      cardY += 5;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.electricBlue[0], colors.electricBlue[1], colors.electricBlue[2]);
      doc.text(`${plan.postActivity.electrolytes}×`, cardX + 8, cardY);
      
      y += cardHeight + 15;

      // ========== AI PERFORMANCE INSIGHTS ==========
      if (aiInsights?.personalized_insight) {
        checkPageBreak(60);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
        doc.text('AI PERFORMANCE INSIGHTS', margin, y);
        y += 8;
        
        const startY = y;
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 50, 2, 2, 'F');
        doc.setDrawColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 50, 2, 2, 'S');
        
        y += 8;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
        addWrappedText(aiInsights.personalized_insight, margin + 8, pageWidth - 2 * margin - 16, 9, colors.charcoal, 1.5);
        
        y += 5;
        
        if (aiInsights.confidence_level) {
          y += 3;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
          doc.text('CONFIDENCE', margin + 8, y);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(colors.electricBlue[0], colors.electricBlue[1], colors.electricBlue[2]);
          doc.text(aiInsights.confidence_level.toUpperCase(), margin + 35, y);
        }
        
        if (aiInsights.risk_factors) {
          y += 8;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
          doc.text('KEY RISKS', margin + 8, y);
          y += 4;
          doc.setFont('helvetica', 'normal');
          const riskColor: [number, number, number] = [180, 40, 40];
          addWrappedText(aiInsights.risk_factors, margin + 8, pageWidth - 2 * margin - 16, 8, riskColor, 1.4);
        }
        
        y += 10;
      }

      // ========== RACE DAY STRATEGY ==========
      if (profile.upcomingEvents) {
        checkPageBreak(90);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
        doc.text('RACE DAY HYDRATION PLAN', margin, y);
        y += 4;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
        doc.text(`For your upcoming: ${profile.upcomingEvents}`, margin, y);
        y += 10;
        
        // Pre-Race
        doc.setFillColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 28, 2, 2, 'F');
        y += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
        doc.text('Pre-Race (Day Before & Morning)', margin + 8, y);
        y += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Day before: Maintain hydration + ${plan.preActivity?.water || 0}ml extra`, margin + 8, y);
        y += 4;
        doc.text(`2 hours before: ${plan.preActivity?.water || 0}ml water + ${plan.preActivity?.electrolytes || 0}× Supplme`, margin + 8, y);
        y += 4;
        doc.text(`30 min before: 200-300ml water (sips only)`, margin + 8, y);
        y += 12;
        
        // During Race
        doc.setFillColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 22, 2, 2, 'F');
        y += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('During Race', margin + 8, y);
        y += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Every 30-45 min: 1 Supplme sachet`, margin + 8, y);
        y += 4;
        if (plan.duringActivity?.waterPerHour) {
          doc.text(`Drink ${plan.duringActivity.waterPerHour}ml water per hour`, margin + 8, y);
          y += 4;
        }
        y += 8;
        
        // Post-Race
        doc.setFillColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
        doc.roundedRect(margin, y, pageWidth - 2 * margin, 18, 2, 2, 'F');
        y += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Post-Race Recovery', margin + 8, y);
        y += 5;
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Start immediately: ${plan.postActivity?.electrolytes || 0}× Supplme over 4-6 hours`, margin + 8, y);
        y += 4;
        doc.text(`Gradually: ${plan.postActivity?.water || 0}ml water over 4-6 hours`, margin + 8, y);
        y += 12;
      }

      // ========== DETAILED PROFILE DATA ==========
      const addDataSection = (title: string, data: Array<{label: string, value: any}>) => {
        const filteredData = data.filter(item => item.value);
        if (filteredData.length === 0) return;
        
        checkPageBreak(30 + filteredData.length * 6);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
        doc.text(title.toUpperCase(), margin, y);
        y += 8;
        
        filteredData.forEach(item => {
          checkPageBreak(7);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
          doc.text(`${item.label}:`, margin + 5, y);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
          const valueText = String(item.value);
          doc.text(valueText.substring(0, 60), margin + 60, y);
          y += 5;
        });
        
        y += 8;
      };

      // Body & Physiology
      addDataSection('Body & Physiology', [
        { label: 'Age', value: profile.age },
        { label: 'Weight', value: profile.weight ? `${profile.weight} kg` : null },
        { label: 'Height', value: profile.height ? `${profile.height} cm` : null },
        { label: 'Sex', value: profile.sex },
        { label: 'Resting HR', value: profile.restingHeartRate ? `${profile.restingHeartRate} bpm` : null }
      ]);

      // Activity Details
      addDataSection('Activity Details', [
        { label: 'Discipline', value: profile.disciplines?.join(', ') },
        { label: 'Race Distance', value: profile.raceDistance },
        { label: 'Session Duration', value: profile.sessionDuration ? `${profile.sessionDuration} hours` : null },
        { label: 'Avg Pace', value: profile.avgPace },
        { label: 'Upcoming Events', value: profile.upcomingEvents }
      ]);

      // Environment
      addDataSection('Environment', [
        { label: 'Training Temp', value: profile.trainingTempRange ? `${profile.trainingTempRange.min}-${profile.trainingTempRange.max}°C` : null },
        { label: 'Humidity', value: profile.humidity ? `${profile.humidity}%` : null },
        { label: 'Altitude', value: profile.altitude },
        { label: 'Sun Exposure', value: profile.sunExposure }
      ]);

      // Sweat Profile
      addDataSection('Sweat Profile', [
        { label: 'Sweat Rate', value: profile.sweatRate },
        { label: 'Sweat Saltiness', value: profile.sweatSaltiness },
        { label: 'Sodium Test', value: profile.sweatSodiumTest ? `${profile.sweatSodiumTest} mg/L` : null },
        { label: 'Daily Salt Intake', value: profile.dailySaltIntake }
      ]);

      // ========== FOOTER ==========
      const footerY = pageHeight - 15;
      doc.setDrawColor(colors.coolGray[0], colors.coolGray[1], colors.coolGray[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(colors.charcoal[0], colors.charcoal[1], colors.charcoal[2]);
      doc.text('SUPPLME', pageWidth / 2, footerY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(colors.mediumGray[0], colors.mediumGray[1], colors.mediumGray[2]);
      doc.text('Science-Backed Hydration & Absorption', pageWidth / 2, footerY + 4, { align: 'center' });

      // Save PDF
      const fileName = `supplme-guide-${profile.fullName?.replace(/\s+/g, '-').toLowerCase() || 'user'}-${new Date().getTime()}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Downloaded",
        description: "Your premium hydration guide is ready.",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Download Failed",
        description: "There was an error generating your PDF. Please try again.",
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
        
        <div className="relative text-center space-y-6 py-8">
          {/* Logo with Glow */}
          <div className="relative inline-block">
            <div className="absolute inset-0 glow-effect blur-3xl opacity-40"></div>
            <img src={supplmeLogo} alt="Supplme" className="h-40 mx-auto relative z-10 performance-pulse" />
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
              ? `${Math.round(profile.sessionDuration * 60)}-minute` 
              : `${profile.sessionDuration.toFixed(1)}-hour`} {profile.disciplines?.[0] || 'activity'}
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
          {profile.sessionDuration.toFixed(1)}-Hour {profile.disciplines?.[0] || 'Activity'} Session
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

        {/* DURING - Solid Black Background with White Text */}
        <Card className="athletic-card p-8 space-y-5 border-4" style={{ backgroundColor: '#0a0a0a', borderColor: '#0a0a0a' }}>
          <div className="space-y-3">
            <div className="flex items-center gap-2" style={{ color: '#ffffff', opacity: 0.7 }}>
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm font-bold uppercase tracking-wider">{plan.duringActivity.frequency}</span>
            </div>
            <h3 className="text-5xl font-black" style={{ color: '#ffffff' }}>DURING</h3>
          </div>
          
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Water per hour</p>
              <p className="text-3xl font-black" style={{ color: '#ffffff' }}>
                {plan.duringActivity.waterPerHour > 0 
                  ? `${plan.duringActivity.waterPerHour} ml` 
                  : 'As needed'}
              </p>
              <p className="text-xs font-semibold mt-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Sip every 15-20 min</p>
            </div>
            <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Supplme Sachets</p>
              <p className="text-3xl font-black" style={{ color: '#ffffff' }}>
                {plan.duringActivity.electrolytesPerHour > 0 
                  ? `${plan.duringActivity.electrolytesPerHour} sachet${plan.duringActivity.electrolytesPerHour > 1 ? 's' : ''}` 
                  : 'Not required'}
              </p>
              {plan.duringActivity.electrolytesPerHour > 0 && (
                <p className="text-xs font-semibold mt-2" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  {plan.duringActivity.electrolytesPerHour === 1 
                    ? `Take 1 after ${Math.round((profile.sessionDuration * 60) / 2)} min`
                    : `1 every ${Math.round((profile.sessionDuration * 60) / plan.duringActivity.electrolytesPerHour)} min`
                  }
                </p>
              )}
            </div>
          </div>

          <p className="text-sm font-medium pt-4" style={{ color: 'rgba(255, 255, 255, 0.85)', borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
            🔥 Maintain peak performance - replace 60-80% of sweat loss
          </p>
        </Card>

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
                <h4 className="font-semibold mb-3">Pre-Race (Day Before & Morning)</h4>
                <ul className="space-y-2 text-sm">
                  <li>• Day before: Maintain normal hydration + {plan.preActivity.water}ml extra</li>
                  <li>• 2 hours before start: {plan.preActivity.water}ml water + <strong>{plan.preActivity.electrolytes}x Supplme sachet</strong></li>
                  <li>• 30 min before start: 200-300ml water (sips only)</li>
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
                    <li>• <strong>Every 30 minutes:</strong> 1 Supplme sachet at aid station</li>
                    {plan.duringActivity.waterPerHour > 0 && (
                      <li>• Drink {Math.round(plan.duringActivity.waterPerHour / 2)}ml water every 15 minutes</li>
                    )}
                    <li>• For marathons: Aim for 3-4 sachets total during race</li>
                    <li>• For ultras: 1 sachet per hour minimum</li>
                  </ul>
                ) : profile.disciplines?.[0] === 'Bike' ? (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Every 45-60 minutes:</strong> 1 Supplme sachet</li>
                    {plan.duringActivity.waterPerHour > 0 && (
                      <li>• Drink {plan.duringActivity.waterPerHour}ml water per hour in small sips</li>
                    )}
                    <li>• Keep sachets in jersey pocket or bike bag for easy access</li>
                  </ul>
                ) : profile.disciplines?.[0] === 'Football' ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">For Football (Soccer):</p>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Pre-Match (60-90 min before):</strong> {Math.round(plan.preActivity.water / 2)}ml water + {plan.preActivity.electrolytes}x Supplme sachet</li>
                      <li>• <strong>Pre-Match (30 min before):</strong> {Math.round(plan.preActivity.water / 3)}ml water</li>
                      <li>• <strong>Half-Time:</strong> 1 Supplme sachet + 200-300ml water</li>
                      <li>• <strong>Post-Match (immediately):</strong> {plan.postActivity.water}ml water + {plan.postActivity.electrolytes}x Supplme sachet</li>
                      <li>• <strong>Post-Match (within 2 hours):</strong> Continue hydrating with water based on urine color</li>
                    </ul>
                  </div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Every 30-45 minutes:</strong> 1 Supplme sachet</li>
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
                  <li>• Start immediately: <strong>{plan.postActivity.electrolytes}x Supplme sachets</strong> over 4-6 hours with the water intake</li>
                  <li>• Over 4-6 hours: {plan.postActivity.water}ml water gradually</li>
                  <li>• Monitor urine color - aim for pale yellow</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}


      {/* AI Insights Section - Moved after plans */}
      {aiInsights && (
        <Card className="p-6 border-2 border-primary/20 bg-primary/5">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">AI-Enhanced Analysis</h3>
              <span className={`ml-auto text-xs px-3 py-1 rounded-full border ${getConfidenceBadgeColor(aiInsights.confidence_level)}`}>
                {aiInsights.confidence_level.toUpperCase()} CONFIDENCE
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Why These Numbers?</h4>
                <p className="text-sm leading-relaxed">{aiInsights.personalized_insight}</p>
              </div>

              {aiInsights.performance_comparison && (
                <div className="bg-accent/50 border border-accent p-3 rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Performance Comparison</h4>
                  <p className="text-sm leading-relaxed">{aiInsights.performance_comparison}</p>
                </div>
              )}

              {aiInsights.optimization_tips && aiInsights.optimization_tips.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Optimization Tips</h4>
                  <ul className="space-y-2">
                    {aiInsights.optimization_tips.map((tip, index) => (
                      <li key={index} className="flex gap-2 text-sm">
                        <span className="text-primary">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {aiInsights.risk_factors && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Key Risk Factors</AlertTitle>
                  <AlertDescription>{aiInsights.risk_factors}</AlertDescription>
                </Alert>
              )}
              
              {aiInsights.professional_recommendation && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Professional Recommendation:</strong> {aiInsights.professional_recommendation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {loadingInsights && (
        <Card className="p-6 border-2 border-primary/20">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Generating AI-enhanced insights...</p>
          </div>
        </Card>
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

      {/* Recommendations */}
      <Card className="p-6 space-y-4">
        <h3 className="text-xl font-semibold">Personalized Recommendations</h3>
        <ul className="space-y-3">
          {plan.recommendations.map((rec, index) => (
            <li key={index} className="flex gap-3 text-muted-foreground">
              <span className="text-primary mt-1">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Scientific References */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Scientific References</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          All hydration recommendations are based on peer-reviewed scientific research from PubMed, 
          the leading database of biomedical literature. Our calculations use evidence-based guidelines 
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
        <Button onClick={onReset} variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
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
