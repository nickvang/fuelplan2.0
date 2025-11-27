import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, LogOut, Trash2, Users, Database, Activity, ChevronDown, ChevronRight, FileDown, Zap } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import supplmeLogo from '@/assets/supplme-logo.png';
import { jsPDF } from 'jspdf';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface HydrationProfileData {
  id: string;
  created_at: string;
  profile_data: any;
  plan_data: any;
  consent_given: boolean;
  has_smartwatch_data: boolean;
  user_email: string | null;
  ip_address: string | unknown | null;
}

export default function Admin() {
  const [profiles, setProfiles] = useState<HydrationProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    total: 0,
    withSmartwatch: 0,
    withoutSmartwatch: 0,
    averageAge: 0,
    genderDistribution: { male: 0, female: 0, other: 0 },
    activityStats: [] as { activity: string; count: number; distances: string[]; raceDayCount: number; trainingCount: number }[],
    sachetsPerActivity: [] as { activity: string; avgSachets: number }[],
  });
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      // Check if user is admin
      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();

      if (roleError || !roles) {
        toast({
          title: "Access Denied",
          description: "You do not have admin privileges.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      await loadProfiles();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/auth');
    }
  };

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_all_hydration_profiles_admin');

      if (error) throw error;

      setProfiles(data || []);
      
      // Calculate enhanced stats
      const total = data?.length || 0;
      const withSmartwatch = data?.filter((p: any) => p.has_smartwatch_data).length || 0;
      
      // Average age
      const ages = data?.map((p: any) => p.profile_data?.age).filter((age: any) => age) || [];
      const averageAge = ages.length > 0 ? parseFloat((ages.reduce((a: number, b: number) => a + b, 0) / ages.length).toFixed(1)) : 0;
      
      // Gender distribution
      const genderCounts = { male: 0, female: 0, other: 0 };
      data?.forEach((p: any) => {
        const sex = p.profile_data?.sex;
        if (sex === 'male') genderCounts.male++;
        else if (sex === 'female') genderCounts.female++;
        else if (sex === 'other') genderCounts.other++;
      });
      
      // Activity popularity with detailed insights
      const activityMap = new Map<string, { count: number; distances: string[]; raceDayCount: number; trainingCount: number }>();
      data?.forEach((p: any) => {
        const disciplines = p.profile_data?.disciplines || [];
        // Try multiple possible distance field names
        const distance = p.profile_data?.raceDistance || p.profile_data?.trainingDistance || '';
        const hasRace = p.profile_data?.hasUpcomingRace;
        
        // Debug logging
        if (disciplines.length > 0) {
          console.log('Profile distance data:', {
            disciplines,
            raceDistance: p.profile_data?.raceDistance,
            trainingDistance: p.profile_data?.trainingDistance,
            hasUpcomingRace: p.profile_data?.hasUpcomingRace,
            allProfileData: Object.keys(p.profile_data || {})
          });
        }
        
        disciplines.forEach((activity: string) => {
          const current = activityMap.get(activity) || { count: 0, distances: [], raceDayCount: 0, trainingCount: 0 };
          current.count++;
          if (distance) current.distances.push(distance);
          if (hasRace) current.raceDayCount++;
          else current.trainingCount++;
          activityMap.set(activity, current);
        });
      });
      
      const activityStats = Array.from(activityMap.entries())
        .map(([activity, data]) => ({ activity, ...data }))
        .sort((a, b) => b.count - a.count);
      
      // Average sachets per activity
      const activitySachetsMap = new Map<string, { total: number; count: number }>();
      data?.forEach((p: any) => {
        const disciplines = p.profile_data?.disciplines || [];
        const plan = p.plan_data;
        
        if (plan?.duringActivity?.electrolytesPerHour && p.profile_data?.sessionDuration) {
          const sachetsUsed = plan.duringActivity.electrolytesPerHour * p.profile_data.sessionDuration;
          
          disciplines.forEach((activity: string) => {
            const current = activitySachetsMap.get(activity) || { total: 0, count: 0 };
            activitySachetsMap.set(activity, {
              total: current.total + sachetsUsed,
              count: current.count + 1
            });
          });
        }
      });
      
      const sachetsPerActivity = Array.from(activitySachetsMap.entries())
        .map(([activity, { total, count }]) => ({
          activity,
          avgSachets: parseFloat((total / count).toFixed(2))
        }))
        .sort((a, b) => b.avgSachets - a.avgSachets);
      
      setStats({
        total,
        withSmartwatch,
        withoutSmartwatch: total - withSmartwatch,
        averageAge,
        genderDistribution: genderCounts,
        activityStats,
        sachetsPerActivity,
      });
    } catch (error: any) {
      toast({
        title: "Error Loading Data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const downloadAllDataCSV = () => {
    const csvRows = [
      ['Supplme Hydration Guide - Complete User Data Export', ''],
      ['Exported', new Date().toLocaleString()],
      ['Total Records', profiles.length],
      ['', ''],
      [
        // Basic Info
        'ID', 'Created At', 'Email', 'Full Name', 'Consent', 'Smartwatch Data',
        // Body & Physiology
        'Age', 'Sex', 'Weight (kg)', 'Height (cm)', 'Body Fat %', 'Resting HR', 'HRV', 'Health Conditions', 'Sweat Sodium Test',
        // Activity & Terrain
        'Disciplines', 'Race Distance', 'Session Duration (hr)', 'Avg Pace', 'Swim Pace', 'Bike Power', 'Run Pace', 
        'Elevation Gain', 'Longest Session', 'Training Frequency', 'Indoor/Outdoor',
        // Football-specific
        'Position', 'Matches/Week', 'Playing Level', 'Playing Surface', 'Avg Distance Covered',
        // Padel-specific
        'Padel Level', 'Court Type', 'Playing Style', 'Padel Matches/Week', 'Tournament Play',
        // Environment
        'Training Temp Min', 'Training Temp Max', 'Race Temp Min', 'Race Temp Max', 'Humidity', 'Altitude',
        'Sun Exposure', 'Wind Conditions', 'Clothing Type', 'Climate',
        // Hydration & Sweat
        'Sweat Rate', 'Sweat Saltiness', 'Fluid Intake', 'Urine Color', 'Cramp Timing', 'Dehydration Symptoms', 'Hydration Strategy',
        // Nutrition
        'Fueling Strategy', 'Pre-Meal Timing', 'Recovery Window', 'Caffeine Strategy', 'Daily Salt Intake',
        'Daily Water Intake', 'Caffeine Intake (mg)', 'Diet Type', 'Nutrition Notes', 'Other Supplements', 'Special Diet',
        // Goals & Performance
        'Target Events', 'Performance Goal', 'Past Issues', 'Primary Goal', 'Upcoming Events', 'Specific Concerns',
        // Optional
        'Weekly Volume', 'Sleep Quality', 'Sleep Hours', 'Other Notes',
        // Plan Data
        'Pre-Water (ml)', 'Pre-Electrolytes', 'During-Water/Hr (ml)', 'During-Electrolytes/Hr', 
        'Post-Water (ml)', 'Post-Electrolytes', 'Total Fluid Loss (ml)'
      ],
    ];

    profiles.forEach(profile => {
      const pd = profile.profile_data || {};
      const plan = profile.plan_data || {};
      
      csvRows.push([
        // Basic Info
        profile.id,
        new Date(profile.created_at).toLocaleString(),
        profile.user_email || 'Anonymous',
        pd.fullName || '',
        profile.consent_given ? 'Yes' : 'No',
        profile.has_smartwatch_data ? 'Yes' : 'No',
        // Body & Physiology
        pd.age || '',
        pd.sex || '',
        pd.weight || '',
        pd.height || '',
        pd.bodyFat || '',
        pd.restingHeartRate || '',
        pd.hrv || '',
        pd.healthConditions || '',
        pd.sweatSodiumTest || '',
        // Activity & Terrain
        (pd.disciplines || []).join('; '),
        pd.raceDistance || '',
        pd.sessionDuration || '',
        pd.avgPace || '',
        pd.swimPace || '',
        pd.bikePower || '',
        pd.runPace || '',
        pd.elevationGain || '',
        pd.longestSession || '',
        pd.trainingFrequency || '',
        pd.indoorOutdoor || '',
        // Football-specific
        pd.position || '',
        pd.matchesPerWeek || '',
        pd.playingLevel || '',
        pd.playingSurface || '',
        pd.avgDistanceCovered || '',
        // Padel-specific
        pd.padelPlayingLevel || '',
        pd.padelCourtType || '',
        pd.padelPlayingStyle || '',
        pd.padelMatchesPerWeek || '',
        pd.padelTournamentPlay ? 'Yes' : '',
        // Environment
        pd.trainingTempRange?.min || '',
        pd.trainingTempRange?.max || '',
        pd.raceTempRange?.min || '',
        pd.raceTempRange?.max || '',
        pd.humidity || '',
        pd.altitude || '',
        pd.sunExposure || '',
        pd.windConditions || '',
        pd.clothingType || '',
        pd.climate || '',
        // Hydration & Sweat
        pd.sweatRate || '',
        pd.sweatSaltiness || '',
        pd.fluidIntake || '',
        pd.urineColor || '',
        pd.crampTiming || '',
        (pd.dehydrationSymptoms || []).join('; '),
        pd.hydrationStrategy || '',
        // Nutrition
        pd.fuelingStrategy || '',
        pd.preMealTiming || '',
        pd.recoveryWindow || '',
        pd.caffeineStrategy || '',
        pd.dailySaltIntake || '',
        pd.dailyWaterIntake || '',
        pd.caffeineIntake || '',
        pd.dietType || '',
        pd.nutritionNotes || '',
        pd.otherSupplements || '',
        pd.specialDiet || '',
        // Goals & Performance
        pd.targetEvents || '',
        pd.performanceGoal || '',
        pd.pastIssues || '',
        pd.primaryGoal || '',
        pd.upcomingEvents || '',
        pd.specificConcerns || '',
        // Optional
        pd.weeklyVolume || '',
        pd.sleepQuality || '',
        pd.sleepHours || '',
        pd.otherNotes || '',
        // Plan Data
        plan.preActivity?.water || '',
        plan.preActivity?.electrolytes || '',
        plan.duringActivity?.waterPerHour || '',
        plan.duringActivity?.electrolytesPerHour || '',
        plan.postActivity?.water || '',
        plan.postActivity?.electrolytes || '',
        plan.totalFluidLoss || '',
      ]);
    });

    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `supplme-all-data-${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export Complete",
      description: `Downloaded ${profiles.length} records as CSV.`,
    });
  };

  const downloadUserGuide = (profile: HydrationProfileData) => {
    const pd = profile.profile_data || {};
    const plan = profile.plan_data || {};
    const aiInsights = plan.aiInsights;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 15;
    let y = 20;

    // Helper function to check if we need a page break
    const checkPageBreak = (neededSpace: number = 40) => {
      if (y + neededSpace > pageHeight - 30) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    // Helper function to add wrapped text
    const addWrappedText = (text: string, x: number, maxWidth: number, fontSize: number = 10, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        checkPageBreak(10);
        doc.text(line, x, y);
        y += fontSize * 0.5;
      });
      y += 2;
    };

    // ====== HEADER ======
    doc.setFillColor(10, 10, 10);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('SUPPLME', pageWidth / 2, 22, { align: 'center' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Your Elite Hydration Strategy', pageWidth / 2, 35, { align: 'center' });
    
    y = 55;
    doc.setTextColor(0, 0, 0);

    // ====== USER INFO ======
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y, pageWidth - 2 * margin, 32, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, pageWidth - 2 * margin, 32);
    
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Name: `, margin + 5, y);
    doc.setFont('helvetica', 'normal');
    doc.text(pd.fullName || 'N/A', margin + 25, y);
    
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(`Email: `, margin + 5, y);
    doc.setFont('helvetica', 'normal');
    doc.text(profile.user_email || 'Anonymous', margin + 25, y);
    
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(`Generated: `, margin + 5, y);
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(profile.created_at).toLocaleString(), margin + 35, y);
    
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(`Discipline: `, margin + 5, y);
    doc.setFont('helvetica', 'normal');
    doc.text((pd.disciplines || []).join(', ') || 'N/A', margin + 35, y);
    
    y += 12;

    // ====== FLUID LOSS SUMMARY ======
    checkPageBreak(50);
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, y, pageWidth - 2 * margin, 45, 'F');
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(1.5);
    doc.rect(margin, y, pageWidth - 2 * margin, 45);
    
    y += 12;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('TOTAL FLUID LOSS', pageWidth / 2, y, { align: 'center' });
    
    y += 13;
    doc.setFontSize(32);
    doc.setTextColor(0, 0, 0);
    doc.text(`${((plan.totalFluidLoss || 0) / 1000).toFixed(1)} L`, pageWidth / 2, y, { align: 'center' });
    
    y += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`during your ${pd.sessionDuration || '0'} hour ${(pd.disciplines || [])[0] || 'activity'}`, pageWidth / 2, y, { align: 'center' });
    
    y += 18;

    // ====== YOUR PERFORMANCE PROTOCOL ======
    checkPageBreak(50);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('YOUR PERFORMANCE PROTOCOL', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // === PRE ===
    checkPageBreak(48);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, pageWidth - 2 * margin, 45, 'FD');
    
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(plan.preActivity?.timing || '2-4 hours before', margin + 5, y);
    
    y += 8;
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('PRE', margin + 5, y);
    
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Water: ${plan.preActivity?.water || 0} ml`, margin + 5, y);
    
    y += 8;
    doc.text(`Supplme Sachets: ${plan.preActivity?.electrolytes || 0}x`, margin + 5, y);
    
    y += 15;

    // === DURING ===
    checkPageBreak(48);
    doc.setFillColor(10, 10, 10);
    doc.rect(margin, y, pageWidth - 2 * margin, 45, 'F');
    
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(200, 200, 200);
    doc.text(plan.duringActivity?.frequency || 'Every 15-20 minutes', margin + 5, y);
    
    y += 8;
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('DURING', margin + 5, y);
    
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Water per hour: ${plan.duringActivity?.waterPerHour || 0} ml`, margin + 5, y);
    
    y += 8;
    doc.text(`Supplme Sachets: ${plan.duringActivity?.electrolytesPerHour || 0} sachet${(plan.duringActivity?.electrolytesPerHour || 0) !== 1 ? 's' : ''}`, margin + 5, y);
    
    y += 15;
    doc.setTextColor(0, 0, 0);

    // === POST ===
    checkPageBreak(48);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, y, pageWidth - 2 * margin, 45, 'FD');
    
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.text(plan.postActivity?.timing || 'Within 30 minutes', margin + 5, y);
    
    y += 8;
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('POST', margin + 5, y);
    
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Water: ${plan.postActivity?.water || 0} ml`, margin + 5, y);
    
    y += 8;
    doc.text(`Supplme Sachets: ${plan.postActivity?.electrolytes || 0}x`, margin + 5, y);
    
    y += 18;

    // ====== AI-ENHANCED ANALYSIS ======
    if (aiInsights) {
      checkPageBreak(60);
      
      doc.setFillColor(240, 245, 255);
      const aiBoxHeight = 80;
      doc.rect(margin, y, pageWidth - 2 * margin, aiBoxHeight, 'F');
      doc.setDrawColor(100, 150, 255);
      doc.setLineWidth(0.5);
      doc.rect(margin, y, pageWidth - 2 * margin, aiBoxHeight);
      
      y += 8;
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('AI-ENHANCED ANALYSIS', margin + 5, y);
      
      if (aiInsights.confidence_level) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        const confidenceText = `${aiInsights.confidence_level.toUpperCase()} CONFIDENCE`;
        const confidenceWidth = doc.getTextWidth(confidenceText);
        const badgeX = pageWidth - margin - confidenceWidth - 10;
        doc.text(confidenceText, badgeX, y);
      }
      
      y += 10;
      
      if (aiInsights.personalized_insight) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text('Why These Numbers?', margin + 5, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        addWrappedText(aiInsights.personalized_insight, margin + 5, pageWidth - 2 * margin - 10, 9);
      }
      
      if (aiInsights.risk_factors) {
        y += 4;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(200, 0, 0);
        doc.text('Key Risk Factors:', margin + 5, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 0, 0);
        addWrappedText(aiInsights.risk_factors, margin + 5, pageWidth - 2 * margin - 10, 9);
      }
      
      y += 8;
    }

    // ====== RACE DAY STRATEGY ======
    if (pd.upcomingEvents) {
      checkPageBreak(100);
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('RACE DAY HYDRATION PLAN', pageWidth / 2, y, { align: 'center' });
      y += 7;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`For your upcoming: ${pd.upcomingEvents}`, pageWidth / 2, y, { align: 'center' });
      y += 12;
      
      // Pre-Race
      checkPageBreak(35);
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, pageWidth - 2 * margin, 32, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, pageWidth - 2 * margin, 32);
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Pre-Race (Day Before & Morning)', margin + 5, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Day before: Maintain normal hydration + ${plan.preActivity?.water || 0}ml extra`, margin + 5, y);
      y += 6;
      doc.text(`• 2 hours before: ${plan.preActivity?.water || 0}ml water + ${plan.preActivity?.electrolytes || 0}x Supplme sachet`, margin + 5, y);
      y += 6;
      doc.text(`• 30 min before start: 200-300ml water (sips only)`, margin + 5, y);
      y += 12;
      
      // During Race
      checkPageBreak(35);
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, pageWidth - 2 * margin, 28, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, pageWidth - 2 * margin, 28);
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('During Race', margin + 5, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Every 30-45 min: 1 Supplme sachet`, margin + 5, y);
      y += 6;
      if (plan.duringActivity?.waterPerHour) {
        doc.text(`• Drink ${plan.duringActivity.waterPerHour}ml water per hour`, margin + 5, y);
        y += 6;
      }
      y += 10;
      
      // Post-Race
      checkPageBreak(28);
      doc.setFillColor(250, 250, 250);
      doc.rect(margin, y, pageWidth - 2 * margin, 24, 'F');
      doc.setDrawColor(200, 200, 200);
      doc.rect(margin, y, pageWidth - 2 * margin, 24);
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Post-Race Recovery', margin + 5, y);
      y += 7;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`• Start immediately: ${plan.postActivity?.electrolytes || 0}x Supplme sachets over 4-6 hours`, margin + 5, y);
      y += 6;
      doc.text(`• Over 4-6 hours: ${plan.postActivity?.water || 0}ml water gradually`, margin + 5, y);
      y += 12;
    }

    // ====== PROFILE DATA SECTIONS ======
    const addDataSection = (title: string, data: Array<{label: string, value: any}>) => {
      const filteredData = data.filter(item => item.value);
      if (filteredData.length === 0) return;
      
      checkPageBreak(30 + filteredData.length * 7);
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(title, margin, y);
      y += 8;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      filteredData.forEach(item => {
        checkPageBreak(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`${item.label}:`, margin + 5, y);
        doc.setFont('helvetica', 'normal');
        const valueText = String(item.value);
        const lines = doc.splitTextToSize(valueText, pageWidth - margin * 2 - 45);
        doc.text(lines, margin + 50, y);
        y += Math.max(6, lines.length * 5);
      });
      y += 6;
    };

    addDataSection('Body & Physiology', [
      { label: 'Age', value: pd.age },
      { label: 'Sex', value: pd.sex },
      { label: 'Weight', value: pd.weight ? `${pd.weight} kg` : null },
      { label: 'Height', value: pd.height ? `${pd.height} cm` : null },
      { label: 'Resting HR', value: pd.restingHeartRate ? `${pd.restingHeartRate} bpm` : null },
    ]);

    addDataSection('Activity Details', [
      { label: 'Session Duration', value: pd.sessionDuration ? `${pd.sessionDuration} hours` : null },
      { label: 'Race Distance', value: pd.raceDistance },
      { label: 'Average Pace', value: pd.avgPace },
      { label: 'Training Frequency', value: pd.trainingFrequency ? `${pd.trainingFrequency}/week` : null },
    ]);

    addDataSection('Environment', [
      { label: 'Temperature', value: pd.raceTempRange ? `${pd.raceTempRange.min}°C - ${pd.raceTempRange.max}°C` : null },
      { label: 'Humidity', value: pd.humidity ? `${pd.humidity}%` : null },
      { label: 'Sun Exposure', value: pd.sunExposure },
    ]);

    addDataSection('Hydration & Sweat Profile', [
      { label: 'Sweat Rate', value: pd.sweatRate },
      { label: 'Sweat Saltiness', value: pd.sweatSaltiness },
      { label: 'Fluid Intake', value: pd.fluidIntake ? `${pd.fluidIntake}L/day` : null },
    ]);

    // ====== FOOTER ======
    const footerY = pageHeight - 20;
    doc.setFillColor(240, 240, 240);
    doc.rect(0, footerY - 5, pageWidth, 25, 'F');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('SUPPLME - Science-Backed Hydration', pageWidth / 2, footerY + 3, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('This personalized guide is based on your individual profile and conditions.', pageWidth / 2, footerY + 10, { align: 'center' });

    // Save PDF
    const fileName = `supplme-guide-${pd.fullName?.replace(/\s+/g, '-').toLowerCase() || profile.id}-${new Date().getTime()}.pdf`;
    doc.save(fileName);

    toast({
      title: "PDF Downloaded",
      description: `Downloaded hydration guide for ${pd.fullName || 'user'}.`,
    });
  };

  const deleteProfile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('hydration_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Profile Deleted",
        description: "The profile has been permanently deleted.",
      });

      await loadProfiles();
    } catch (error: any) {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <img src={supplmeLogo} alt="Supplme" className="h-20" />
            <div>
              <h1 className="text-3xl font-bold">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage hydration profile data</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" className="gap-2">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/20 rounded-full">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Profiles</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/20 rounded-full">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Smartwatch Entries</p>
                <p className="text-3xl font-bold text-foreground">{stats.withSmartwatch}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-full">
                <Database className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Average Age</p>
                <p className="text-3xl font-bold text-foreground">{stats.averageAge} <span className="text-lg">yrs</span></p>
              </div>
            </div>
          </Card>
        </div>

        {/* Analytics Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Gender Distribution */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Gender & Age Distribution</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Male', value: stats.genderDistribution.male },
                    { name: 'Female', value: stats.genderDistribution.female },
                    { name: 'Other', value: stats.genderDistribution.other },
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="hsl(var(--primary))" />
                  <Cell fill="hsl(var(--chart-2))" />
                  <Cell fill="hsl(var(--chart-3))" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-medium">Average Age</span>
                <span className="text-lg font-bold text-primary">{stats.averageAge} years</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--primary))' }} />
                  Male
                </span>
                <span className="font-semibold">{stats.genderDistribution.male}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-2))' }} />
                  Female
                </span>
                <span className="font-semibold">{stats.genderDistribution.female}</span>
              </div>
              {stats.genderDistribution.other > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'hsl(var(--chart-3))' }} />
                    Other
                  </span>
                  <span className="font-semibold">{stats.genderDistribution.other}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Activity Popularity */}
          <Card className="p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4">Most Popular Activities (Click to see details)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.activityStats.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="activity" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Bar 
                  dataKey="count" 
                  fill="hsl(var(--primary))" 
                  radius={[8, 8, 0, 0]}
                  onClick={(data) => setSelectedActivity(data.activity)}
                  className="cursor-pointer hover:opacity-80"
                />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Activity Details Modal */}
          {selectedActivity && (
            <Card className="p-6 lg:col-span-3 bg-accent/5 border-accent">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold">{selectedActivity} - Detailed Insights</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedActivity(null)}>
                  Close
                </Button>
              </div>
              
              {(() => {
                const activity = stats.activityStats.find(a => a.activity === selectedActivity);
                if (!activity) return null;
                
                // Count unique distances
                const distanceCounts = new Map<string, number>();
                activity.distances.forEach(d => {
                  distanceCounts.set(d, (distanceCounts.get(d) || 0) + 1);
                });
                const sortedDistances = Array.from(distanceCounts.entries())
                  .sort((a, b) => b[1] - a[1]);
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Mode Usage */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm text-muted-foreground">Mode Usage</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <span className="text-sm">Race Day Mode</span>
                          <span className="text-xl font-bold text-primary">{activity.raceDayCount}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-background rounded-lg">
                          <span className="text-sm">Training Mode</span>
                          <span className="text-xl font-bold text-chart-1">{activity.trainingCount}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Most Common Distances */}
                    <div className="md:col-span-2 space-y-3">
                      <h4 className="font-semibold text-sm text-muted-foreground">Most Common Distances</h4>
                      <div className="grid grid-cols-2 gap-3">
                        {sortedDistances.slice(0, 8).map(([distance, count]) => (
                          <div key={distance} className="flex justify-between items-center p-3 bg-background rounded-lg">
                            <span className="text-sm font-medium">{distance}</span>
                            <Badge variant="secondary">{count}x</Badge>
                          </div>
                        ))}
                        {sortedDistances.length === 0 && (
                          <p className="text-sm text-muted-foreground col-span-2">No distance data available</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={downloadAllDataCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export All Data (CSV)
          </Button>
          <Button onClick={loadProfiles} variant="outline">
            Refresh Data
          </Button>
        </div>

        {/* Data Table */}
        <Card className="p-6">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">User Submissions</h2>
            
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading data...</p>
            ) : profiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data collected yet.</p>
            ) : (
              <div className="space-y-2">
                {profiles.map((profile) => {
                  const pd = profile.profile_data || {};
                  const plan = profile.plan_data || {};
                  const isExpanded = expandedRows.has(profile.id);
                  
                  return (
                    <Card key={profile.id} className="p-4">
                      <Collapsible open={isExpanded} onOpenChange={() => toggleRow(profile.id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="p-1">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            </CollapsibleTrigger>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 flex-1">
                              <div>
                                <p className="text-xs text-muted-foreground">Date</p>
                                <p className="text-sm font-medium">{new Date(profile.created_at).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Full Name</p>
                                <p className="text-sm font-medium">{pd.fullName || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Email</p>
                                <p className="text-sm font-medium">{profile.user_email || 'Anonymous'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Discipline</p>
                                <p className="text-sm font-medium">{pd.disciplines?.[0] || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Age / Sex</p>
                                <p className="text-sm font-medium">{pd.age || '?'} / {pd.sex || '?'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Smartwatch</p>
                                {profile.has_smartwatch_data ? (
                                  <Badge variant="default">Yes</Badge>
                                ) : (
                                  <Badge variant="outline">No</Badge>
                                )}
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Consent</p>
                                {profile.consent_given ? (
                                  <Badge variant="default" className="bg-green-500">✓</Badge>
                                ) : (
                                  <Badge variant="destructive">✗</Badge>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => downloadUserGuide(profile)}
                                variant="ghost"
                                size="sm"
                                className="text-primary hover:text-primary"
                                title="Download user's hydration guide"
                              >
                                <FileDown className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => deleteProfile(profile.id)}
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        
                        <CollapsibleContent className="mt-4 pt-4 border-t">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Body & Physiology */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Body & Physiology</h4>
                              <div className="space-y-1 text-sm">
                                {pd.weight && <p><span className="text-muted-foreground">Weight:</span> {pd.weight}kg</p>}
                                {pd.height && <p><span className="text-muted-foreground">Height:</span> {pd.height}cm</p>}
                                {pd.bodyFat && <p><span className="text-muted-foreground">Body Fat:</span> {pd.bodyFat}%</p>}
                                {pd.restingHeartRate && <p><span className="text-muted-foreground">Resting HR:</span> {pd.restingHeartRate}</p>}
                                {pd.hrv && <p><span className="text-muted-foreground">HRV:</span> {pd.hrv}</p>}
                                {pd.healthConditions && <p><span className="text-muted-foreground">Health:</span> {pd.healthConditions}</p>}
                                {pd.sweatSodiumTest && <p><span className="text-muted-foreground">Sweat Sodium:</span> {pd.sweatSodiumTest}</p>}
                              </div>
                            </div>
                            
                            {/* Activity & Terrain */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Activity & Terrain</h4>
                              <div className="space-y-1 text-sm">
                                {pd.sessionDuration && <p><span className="text-muted-foreground">Duration:</span> {pd.sessionDuration}hrs</p>}
                                {pd.indoorOutdoor && <p><span className="text-muted-foreground">Location:</span> {pd.indoorOutdoor}</p>}
                                {pd.raceDistance && <p><span className="text-muted-foreground">Distance:</span> {pd.raceDistance}</p>}
                                {pd.avgPace && <p><span className="text-muted-foreground">Avg Pace:</span> {pd.avgPace}</p>}
                                {pd.swimPace && <p><span className="text-muted-foreground">Swim Pace:</span> {pd.swimPace}</p>}
                                {pd.bikePower && <p><span className="text-muted-foreground">Bike Power:</span> {pd.bikePower}</p>}
                                {pd.runPace && <p><span className="text-muted-foreground">Run Pace:</span> {pd.runPace}</p>}
                                {pd.elevationGain && <p><span className="text-muted-foreground">Elevation:</span> {pd.elevationGain}m</p>}
                                {pd.trainingFrequency && <p><span className="text-muted-foreground">Frequency:</span> {pd.trainingFrequency}/week</p>}
                              </div>
                            </div>
                            
                            {/* Environment */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Environment</h4>
                              <div className="space-y-1 text-sm">
                                {pd.trainingTempRange && <p><span className="text-muted-foreground">Temp:</span> {pd.trainingTempRange.min}°C - {pd.trainingTempRange.max}°C</p>}
                                {pd.humidity && <p><span className="text-muted-foreground">Humidity:</span> {pd.humidity}%</p>}
                                {pd.altitude && <p><span className="text-muted-foreground">Altitude:</span> {pd.altitude}</p>}
                                {pd.altitudeMeters && <p><span className="text-muted-foreground">Altitude (exact):</span> {pd.altitudeMeters}m</p>}
                                {pd.sunExposure && <p><span className="text-muted-foreground">Sun:</span> {pd.sunExposure}</p>}
                                {pd.windConditions && <p><span className="text-muted-foreground">Wind:</span> {pd.windConditions}</p>}
                                {pd.clothingType && <p><span className="text-muted-foreground">Clothing:</span> {pd.clothingType}</p>}
                                {pd.climate && <p><span className="text-muted-foreground">Climate:</span> {pd.climate}</p>}
                              </div>
                            </div>
                            
                            {/* Hydration & Sweat */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Hydration & Sweat</h4>
                              <div className="space-y-1 text-sm">
                                {pd.sweatRate && <p><span className="text-muted-foreground">Sweat Rate:</span> {pd.sweatRate}</p>}
                                {pd.sweatSaltiness && <p><span className="text-muted-foreground">Saltiness:</span> {pd.sweatSaltiness}</p>}
                                {pd.fluidIntake && <p><span className="text-muted-foreground">Fluid Intake:</span> {pd.fluidIntake}L</p>}
                                {pd.urineColor && <p><span className="text-muted-foreground">Urine Color:</span> {pd.urineColor}</p>}
                                {pd.crampTiming && <p><span className="text-muted-foreground">Cramps:</span> {pd.crampTiming}</p>}
                                {pd.dehydrationSymptoms && pd.dehydrationSymptoms.length > 0 && (
                                  <p><span className="text-muted-foreground">Symptoms:</span> {pd.dehydrationSymptoms.join(', ')}</p>
                                )}
                                {pd.hydrationStrategy && <p><span className="text-muted-foreground">Strategy:</span> {pd.hydrationStrategy}</p>}
                              </div>
                            </div>
                            
                            {/* Nutrition */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Nutrition</h4>
                              <div className="space-y-1 text-sm">
                                {pd.dailySaltIntake && <p><span className="text-muted-foreground">Daily Salt:</span> {pd.dailySaltIntake}</p>}
                                {pd.dailyWaterIntake && <p><span className="text-muted-foreground">Daily Water:</span> {pd.dailyWaterIntake}L</p>}
                                {pd.caffeineIntake && <p><span className="text-muted-foreground">Caffeine:</span> {pd.caffeineIntake}mg</p>}
                                {pd.dietType && <p><span className="text-muted-foreground">Diet:</span> {pd.dietType}</p>}
                                {pd.fuelingStrategy && <p><span className="text-muted-foreground">Fueling:</span> {pd.fuelingStrategy}</p>}
                                {pd.caffeineStrategy && <p><span className="text-muted-foreground">Caffeine Strategy:</span> {pd.caffeineStrategy}</p>}
                                {pd.otherSupplements && <p><span className="text-muted-foreground">Supplements:</span> {pd.otherSupplements}</p>}
                              </div>
                            </div>
                            
                            {/* Hydration Plan Results */}
                            <div className="space-y-2 bg-primary/5 p-3 rounded-lg border border-primary/20">
                              <h4 className="font-semibold text-sm text-primary">Hydration Plan Results</h4>
                              <div className="space-y-2 text-sm">
                                <div className="space-y-1">
                                  <p className="font-medium">PRE-Activity:</p>
                                  <p className="pl-2"><span className="text-muted-foreground">Water:</span> {plan.preActivity?.water || 0}ml</p>
                                  <p className="pl-2"><span className="text-muted-foreground">Supplme Sachets:</span> {plan.preActivity?.electrolytes || 0}</p>
                                  {plan.preActivity?.timing && <p className="pl-2"><span className="text-muted-foreground">Timing:</span> {plan.preActivity.timing}</p>}
                                </div>
                                <div className="space-y-1">
                                  <p className="font-medium">DURING Activity:</p>
                                  <p className="pl-2"><span className="text-muted-foreground">Water:</span> {plan.duringActivity?.waterPerHour || 0}ml/hr</p>
                                  <p className="pl-2"><span className="text-muted-foreground">Supplme Sachets:</span> {plan.duringActivity?.electrolytesPerHour ?? 0}/hr</p>
                                  {plan.duringActivity?.frequency && <p className="pl-2"><span className="text-muted-foreground">Frequency:</span> {plan.duringActivity.frequency}</p>}
                                </div>
                                <div className="space-y-1">
                                  <p className="font-medium">POST-Activity:</p>
                                  <p className="pl-2"><span className="text-muted-foreground">Water:</span> {plan.postActivity?.water || 0}ml</p>
                                  <p className="pl-2"><span className="text-muted-foreground">Supplme Sachets:</span> {plan.postActivity?.electrolytes || 0}</p>
                                  {plan.postActivity?.timing && <p className="pl-2"><span className="text-muted-foreground">Timing:</span> {plan.postActivity.timing}</p>}
                                </div>
                                {plan.totalFluidLoss && (
                                  <p className="pt-2 border-t"><span className="text-muted-foreground font-medium">Total Fluid Loss:</span> {(plan.totalFluidLoss / 1000).toFixed(1)}L</p>
                                )}
                              </div>
                            </div>
                            
                            {/* Sport-Specific Data (Football) */}
                            {(pd.position || pd.matchesPerWeek || pd.playingLevel) && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Football Data</h4>
                                <div className="space-y-1 text-sm">
                                  {pd.position && <p><span className="text-muted-foreground">Position:</span> {pd.position}</p>}
                                  {pd.matchesPerWeek && <p><span className="text-muted-foreground">Matches/Week:</span> {pd.matchesPerWeek}</p>}
                                  {pd.playingLevel && <p><span className="text-muted-foreground">Level:</span> {pd.playingLevel}</p>}
                                  {pd.playingSurface && <p><span className="text-muted-foreground">Surface:</span> {pd.playingSurface}</p>}
                                  {pd.avgDistanceCovered && <p><span className="text-muted-foreground">Avg Distance:</span> {pd.avgDistanceCovered}km</p>}
                                </div>
                              </div>
                            )}
                            
                            {/* Sport-Specific Data (Padel) */}
                            {(pd.padelPlayingLevel || pd.padelCourtType || pd.padelMatchesPerWeek) && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Padel Data</h4>
                                <div className="space-y-1 text-sm">
                                  {pd.padelPlayingLevel && <p><span className="text-muted-foreground">Level:</span> {pd.padelPlayingLevel}</p>}
                                  {pd.padelCourtType && <p><span className="text-muted-foreground">Court:</span> {pd.padelCourtType}</p>}
                                  {pd.padelPlayingStyle && <p><span className="text-muted-foreground">Style:</span> {pd.padelPlayingStyle}</p>}
                                  {pd.padelMatchesPerWeek && <p><span className="text-muted-foreground">Matches/Week:</span> {pd.padelMatchesPerWeek}</p>}
                                  {pd.padelTournamentPlay && <p><span className="text-muted-foreground">Tournament:</span> Yes</p>}
                                </div>
                              </div>
                            )}
                            
                            {/* Goals & Notes */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Goals & Notes</h4>
                              <div className="space-y-1 text-sm">
                                {pd.primaryGoal && <p><span className="text-muted-foreground">Primary Goal:</span> {pd.primaryGoal}</p>}
                                {pd.performanceGoal && <p><span className="text-muted-foreground">Performance:</span> {pd.performanceGoal}</p>}
                                {pd.upcomingEvents && <p><span className="text-muted-foreground">Events:</span> {pd.upcomingEvents}</p>}
                                {pd.pastIssues && <p><span className="text-muted-foreground">Past Issues:</span> {pd.pastIssues}</p>}
                                {pd.specificConcerns && <p><span className="text-muted-foreground">Concerns:</span> {pd.specificConcerns}</p>}
                                {pd.otherNotes && <p><span className="text-muted-foreground">Notes:</span> {pd.otherNotes}</p>}
                              </div>
                            </div>
                            
                            {/* Sleep & Recovery */}
                            {(pd.sleepHours || pd.sleepQuality || pd.weeklyVolume) && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm">Sleep & Recovery</h4>
                                <div className="space-y-1 text-sm">
                                  {pd.sleepHours && <p><span className="text-muted-foreground">Sleep:</span> {pd.sleepHours}hrs</p>}
                                  {pd.sleepQuality && <p><span className="text-muted-foreground">Sleep Quality:</span> {pd.sleepQuality}/10</p>}
                                  {pd.weeklyVolume && <p><span className="text-muted-foreground">Weekly Volume:</span> {pd.weeklyVolume}hrs</p>}
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}