import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, LogOut, Trash2, Users, Database, Activity, ChevronDown, ChevronRight, FileDown, Zap, RefreshCw } from 'lucide-react';
import { FullHydrationPlanProtocol } from '@/components/FullHydrationPlanProtocol';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import supplmeLogo from '@/assets/SUPPLME(r)hvid.svg';
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
    withStrava: 0,
    avgStravaActivitiesPerUser: 0,
    averageAge: 0,
    genderDistribution: { male: 0, female: 0, other: 0 },
    activityStats: [] as { activity: string; count: number; distances: string[]; raceDayCount: number; trainingCount: number }[],
    sachetsPerActivity: [] as { activity: string; avgSachets: number }[],
    // Product development aggregates
    sweatRateDistribution: { low: 0, medium: 0, high: 0 },
    sweatSaltinessDistribution: { low: 0, medium: 0, high: 0 },
    avgFluidLossMl: 0,
    avgElectrolytesPerHour: 0,
    avgWaterPerHourDuring: 0,
    avgSodiumLossPerHourMg: 0,
    avgSessionDurationHours: 0,
    totalWithPlan: 0,
    sodiumLossBuckets: [] as { label: string; avgMg: number; count: number }[],
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        if (sessionError) console.error("Session fetch error:", sessionError);
        navigate('/auth');
        return;
      }

      // Robust check for admin role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleError) {
        console.error("Critical role fetch error:", roleError);
        toast({
          title: "System Error",
          description: "Could not verify permissions. Please try logging in again.",
          variant: "destructive",
        });
        navigate('/auth');
        return;
      }

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "Restricted area. Admin privileges required.",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      await loadProfiles();
    } catch (error: any) {
      console.error('Unexpected error in admin check:', error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
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
      const withStrava = data?.filter((p: any) => p.profile_data?.strava_snapshot).length || 0;

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

        if (plan?.duringActivity?.totalElectrolytes && p.profile_data?.sessionDuration) {
          const sachetsUsed = plan.duringActivity.totalElectrolytes;

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

      // Product development: sweat, fluid, electrolytes, sodium
      const sweatRateCounts = { low: 0, medium: 0, high: 0 };
      const sweatSaltinessCounts = { low: 0, medium: 0, high: 0 };
      let fluidLossSum = 0, fluidLossN = 0;
      let electrolytesPerHourSum = 0, electrolytesPerHourN = 0;
      let waterPerHourSum = 0, waterPerHourN = 0;
      let sodiumPerHourSum = 0, sodiumPerHourN = 0;
      let sessionDurationSum = 0, sessionDurationN = 0;
      const SODIUM_MG_PER_HOUR: Record<string, number> = { low: 400, medium: 650, high: 1100 };
      const sodiumBucketsMap: Record<string, { totalMg: number; count: number }> = {
        low: { totalMg: 0, count: 0 },
        medium: { totalMg: 0, count: 0 },
        high: { totalMg: 0, count: 0 },
        known: { totalMg: 0, count: 0 },
      };
      let totalStravaActivities = 0;

      data?.forEach((p: any) => {
        const pd = p.profile_data || {};
        const plan = p.plan_data || {};
        const sr = pd.sweatRate;
        const ss = pd.sweatSaltiness;
        if (sr === 'low') sweatRateCounts.low++;
        else if (sr === 'medium') sweatRateCounts.medium++;
        else if (sr === 'high') sweatRateCounts.high++;
        if (ss === 'low') sweatSaltinessCounts.low++;
        else if (ss === 'medium') sweatSaltinessCounts.medium++;
        else if (ss === 'high') sweatSaltinessCounts.high++;
        if (plan.totalFluidLoss != null) { fluidLossSum += plan.totalFluidLoss; fluidLossN++; }
        const eph = plan.duringActivity?.electrolytesPerHour;
        if (eph != null) { electrolytesPerHourSum += eph; electrolytesPerHourN++; }
        const wph = plan.duringActivity?.waterPerHour;
        if (wph != null) { waterPerHourSum += wph; waterPerHourN++; }
        const dur = pd.sessionDuration;
        if (dur != null) { sessionDurationSum += dur; sessionDurationN++; }

        // Sodium loss per hour bucketed by sweatSaltiness or known lab value
        const knownNa = pd.knownSodiumLossPerHour;
        let bucketKey: 'low' | 'medium' | 'high' | 'known' | null = null;
        let sodiumPh: number | null = null;
        if (knownNa != null && Number.isFinite(knownNa) && knownNa >= 200 && knownNa <= 2000) {
          sodiumPh = Math.round(knownNa);
          bucketKey = 'known';
        } else if (ss && (ss === 'low' || ss === 'medium' || ss === 'high')) {
          sodiumPh = SODIUM_MG_PER_HOUR[ss] ?? 650;
          bucketKey = ss;
        }
        if (sodiumPh != null && bucketKey) {
          sodiumPerHourSum += sodiumPh;
          sodiumPerHourN++;
          sodiumBucketsMap[bucketKey].totalMg += sodiumPh;
          sodiumBucketsMap[bucketKey].count += 1;
        }

        const snapshot = pd.strava_snapshot;
        if (snapshot && Array.isArray(snapshot.activities)) {
          totalStravaActivities += snapshot.activities.length;
        }
      });

      const totalWithPlan = fluidLossN;
      const sodiumLossBuckets = Object.entries(sodiumBucketsMap)
        .map(([key, value]) => ({
          label: key === 'known' ? 'Known (lab/test)' : key.charAt(0).toUpperCase() + key.slice(1),
          avgMg: value.count ? Math.round(value.totalMg / value.count) : 0,
          count: value.count,
        }))
        .filter((b) => b.count > 0);
      const avgStravaActivitiesPerUser = withStrava
        ? Math.round((totalStravaActivities / withStrava) * 10) / 10
        : 0;
      setStats({
        total,
        withSmartwatch,
        withoutSmartwatch: total - withSmartwatch,
        averageAge,
        genderDistribution: genderCounts,
        activityStats,
        sachetsPerActivity,
        sweatRateDistribution: sweatRateCounts,
        sweatSaltinessDistribution: sweatSaltinessCounts,
        avgFluidLossMl: fluidLossN ? Math.round(fluidLossSum / fluidLossN) : 0,
        avgElectrolytesPerHour: electrolytesPerHourN ? Math.round((electrolytesPerHourSum / electrolytesPerHourN) * 100) / 100 : 0,
        avgWaterPerHourDuring: waterPerHourN ? Math.round(waterPerHourSum / waterPerHourN) : 0,
        avgSodiumLossPerHourMg: sodiumPerHourN ? Math.round(sodiumPerHourSum / sodiumPerHourN) : 0,
        avgSessionDurationHours: sessionDurationN ? Math.round((sessionDurationSum / sessionDurationN) * 10) / 10 : 0,
        totalWithPlan,
        withStrava,
        avgStravaActivitiesPerUser,
        sodiumLossBuckets,
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
    const addDataSection = (title: string, data: Array<{ label: string, value: any }>) => {
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
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Checking access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-800 pb-4 border-l-4 border-emerald-500/60">
          <div className="flex items-center gap-3 pl-1">
            <img src={supplmeLogo} alt="Supplme" className="h-12 opacity-95" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-zinc-100">Data Center</h1>
              <p className="text-xs text-zinc-500">User submissions & product development</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="outline" size="sm" className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-red-500/30 hover:text-red-400/90">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        {/* Key metrics strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="rounded-lg bg-zinc-900 border border-emerald-500/20 p-4 border-l-4 border-l-emerald-500/60">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Submissions</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5 text-emerald-400/90">{stats.total}</p>
          </div>
          <div className="rounded-lg bg-zinc-900 border border-emerald-500/20 p-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Smartwatch</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5 text-emerald-400/90">{stats.withSmartwatch}</p>
          </div>
          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg fluid loss</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">{(stats.avgFluidLossMl / 1000).toFixed(1)}<span className="text-sm font-normal text-zinc-500"> L</span></p>
          </div>
          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg sachets/hr</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.avgElectrolytesPerHour}<span className="text-sm font-normal text-zinc-500"></span></p>
          </div>
          <div className="rounded-lg bg-zinc-900 border border-red-500/20 p-4 border-l-4 border-l-red-500/50">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg Na loss/hr</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5 text-red-400/90">{stats.avgSodiumLossPerHourMg}<span className="text-sm font-normal text-zinc-500"> mg</span></p>
          </div>
          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg age</p>
            <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.averageAge}<span className="text-sm font-normal text-zinc-500"> yrs</span></p>
          </div>
        </div>

        {/* Product development */}
        <div className="rounded-xl border border-zinc-800 border-t-4 border-t-emerald-500/40 bg-zinc-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-emerald-500/5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400/90">Product development</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Hydration, sweat & electrolyte insights for Supplme</p>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            <div className="rounded-lg bg-zinc-800/80 border border-emerald-500/15 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg fluid loss</p>
              <p className="text-xl font-bold tabular-nums text-emerald-400/90">{(stats.avgFluidLossMl / 1000).toFixed(1)} L</p>
              <p className="text-[10px] text-zinc-500 mt-1">per session (n={stats.totalWithPlan})</p>
            </div>
            <div className="rounded-lg bg-zinc-800/80 border border-red-500/15 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg sodium loss/hr</p>
              <p className="text-xl font-bold tabular-nums text-red-400/90">{stats.avgSodiumLossPerHourMg} mg</p>
              <p className="text-[10px] text-zinc-500 mt-1">estimated from sweat saltiness</p>
            </div>
            <div className="rounded-lg bg-zinc-800/80 border border-emerald-500/15 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg electrolytes/hr</p>
              <p className="text-xl font-bold tabular-nums text-emerald-400/90">{stats.avgElectrolytesPerHour} sachets</p>
              <p className="text-[10px] text-zinc-500 mt-1">during activity</p>
            </div>
            <div className="rounded-lg bg-zinc-800/80 border border-zinc-700 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg water/hr</p>
              <p className="text-xl font-bold tabular-nums text-white">{stats.avgWaterPerHourDuring} ml</p>
              <p className="text-[10px] text-zinc-500 mt-1">during activity</p>
            </div>
            <div className="rounded-lg bg-zinc-800/80 border border-zinc-700 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Avg session</p>
              <p className="text-xl font-bold tabular-nums text-white">{stats.avgSessionDurationHours} h</p>
              <p className="text-[10px] text-zinc-500 mt-1">duration</p>
            </div>
            <div className="rounded-lg bg-zinc-800/80 border border-zinc-700 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Sweat rate</p>
              <div className="flex gap-2 mt-1.5 text-xs">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">L: {stats.sweatRateDistribution.low}</span>
                <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">M: {stats.sweatRateDistribution.medium}</span>
                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400/80 border border-red-500/20">H: {stats.sweatRateDistribution.high}</span>
              </div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 border border-zinc-700 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Sweat saltiness</p>
              <div className="flex gap-2 mt-1.5 text-xs">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400/80 border border-emerald-500/20">L: {stats.sweatSaltinessDistribution.low}</span>
                <span className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">M: {stats.sweatSaltinessDistribution.medium}</span>
                <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400/80 border border-red-500/20">H: {stats.sweatSaltinessDistribution.high}</span>
              </div>
            </div>
            <div className="rounded-lg bg-zinc-800/80 border border-orange-500/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Strava-linked users</p>
              <p className="text-xl font-bold tabular-nums text-orange-400/90">{stats.withStrava}</p>
              <p className="text-[10px] text-zinc-500 mt-1">avg {stats.avgStravaActivitiesPerUser.toFixed(1)} activities imported</p>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-zinc-800 border-l-4 border-l-emerald-500/50 bg-zinc-900/50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Gender</h3>
            <ResponsiveContainer width="100%" height={200}>
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
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={70}
                  dataKey="value"
                >
                  <Cell fill="#34d399" />
                  <Cell fill="#f87171" />
                  <Cell fill="#a1a1aa" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-emerald-400/90">M {stats.genderDistribution.male}</span>
              <span className="text-red-400/90">F {stats.genderDistribution.female}</span>
              <span className="text-zinc-400">O {stats.genderDistribution.other}</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800 border-l-4 border-l-orange-500/60 bg-zinc-900/50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Avg sodium loss / hr</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.sodiumLossBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="label" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }} />
                <Bar dataKey="avgMg" fill="#fb923c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-zinc-500">
              n={stats.sodiumLossBuckets.reduce((sum, b) => sum + b.count, 0)} profiles
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 border-l-4 border-l-red-500/40 bg-zinc-900/50 p-4 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-3">Activities (click bar)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.activityStats.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                <XAxis dataKey="activity" tick={{ fill: '#a1a1aa', fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }} />
                <Bar dataKey="count" fill="#34d399" radius={[4, 4, 0, 0]} onClick={(data) => setSelectedActivity(data.activity)} className="cursor-pointer hover:opacity-90" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {selectedActivity && (
            <div className="rounded-xl border border-zinc-700 border-t-4 border-t-emerald-500/40 bg-zinc-800/80 p-4 lg:col-span-3">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-sm font-semibold text-zinc-200">{selectedActivity}</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedActivity(null)} className="text-zinc-400 hover:text-red-400/90">
                  Close
                </Button>
              </div>
              {(() => {
                const activity = stats.activityStats.find(a => a.activity === selectedActivity);
                if (!activity) return null;
                const distanceCounts = new Map<string, number>();
                activity.distances.forEach((d: string) => distanceCounts.set(d, (distanceCounts.get(d) || 0) + 1));
                const sortedDistances = Array.from(distanceCounts.entries()).sort((a, b) => b[1] - a[1]);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-500">Mode</h4>
                      <div className="flex justify-between rounded-lg bg-zinc-800 border border-zinc-700 p-3">
                        <span className="text-xs text-zinc-400">Race</span>
                        <span className="font-bold tabular-nums text-zinc-100">{activity.raceDayCount}</span>
                      </div>
                      <div className="flex justify-between rounded-lg bg-zinc-800 border border-zinc-700 p-3">
                        <span className="text-xs text-zinc-400">Training</span>
                        <span className="font-bold tabular-nums text-zinc-100">{activity.trainingCount}</span>
                      </div>
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <h4 className="text-[10px] uppercase tracking-wider text-zinc-500">Distances</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {sortedDistances.slice(0, 8).map(([distance, count]) => (
                          <div key={distance} className="flex justify-between items-center rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2">
                            <span className="text-xs text-zinc-300 truncate">{distance || '—'}</span>
                            <span className="text-xs tabular-nums text-zinc-500">{count}x</span>
                          </div>
                        ))}
                        {sortedDistances.length === 0 && <p className="text-xs text-zinc-500 col-span-2">No distance data</p>}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadAllDataCSV} size="sm" className="gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button onClick={loadProfiles} variant="outline" size="sm" className="gap-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:border-emerald-500/30 hover:text-emerald-400/90">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <div className="rounded-xl border border-zinc-800 border-t-4 border-t-red-500/40 bg-zinc-900/50 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-red-500/5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-red-400/90">User submissions</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Expand row to see full hydration plan and profile.</p>
          </div>
          <div className="p-4">
            {loading ? (
              <p className="text-center text-zinc-500 py-8">Loading...</p>
            ) : profiles.length === 0 ? (
              <p className="text-center text-zinc-500 py-8">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {profiles.map((profile) => {
                  const pd = profile.profile_data || {};
                  const plan = profile.plan_data || {};
                  const isExpanded = expandedRows.has(profile.id);

                  return (
                    <div key={profile.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 border-l-4 border-l-zinc-700 hover:border-l-emerald-500/40 transition-colors">
                      <Collapsible open={isExpanded} onOpenChange={() => toggleRow(profile.id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="p-1 text-zinc-400 hover:text-zinc-100">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            </CollapsibleTrigger>

                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 flex-1">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Date</p>
                                <p className="text-sm font-medium text-zinc-200 tabular-nums">{new Date(profile.created_at).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Name</p>
                                <p className="text-sm font-medium text-zinc-200">{pd.fullName || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Email</p>
                                <p className="text-sm font-medium text-zinc-200 truncate max-w-[140px]">{profile.user_email || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Discipline</p>
                                <p className="text-sm font-medium text-zinc-200">{pd.disciplines?.[0] || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Age / Sex</p>
                                <p className="text-sm font-medium text-zinc-200 tabular-nums">{pd.age || '?'} / {pd.sex || '?'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Watch</p>
                                {profile.has_smartwatch_data ? (
                                  <span className="text-xs text-emerald-400">Yes</span>
                                ) : (
                                  <span className="text-xs text-zinc-500">No</span>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Strava</p>
                                {pd.strava_snapshot ? (
                                  <Badge variant="secondary" className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/40">
                                    Yes
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-zinc-500">No</span>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Consent</p>
                                {profile.consent_given ? (
                                  <span className="text-xs text-emerald-400">✓</span>
                                ) : (
                                  <span className="text-xs text-red-400">✗</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                onClick={() => downloadUserGuide(profile)}
                                variant="ghost"
                                size="sm"
                                className="text-zinc-400 hover:text-zinc-100"
                                title="Download hydration guide"
                              >
                                <FileDown className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => deleteProfile(profile.id)}
                                variant="ghost"
                                size="sm"
                                className="text-zinc-400 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <CollapsibleContent className="mt-4 pt-4 border-t border-zinc-800">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pd.strava_snapshot && (
                              <div className="col-span-full space-y-4 mb-4 p-4 rounded-lg bg-zinc-800/50 border border-orange-500/20">
                                <h4 className="font-semibold text-sm text-orange-400 flex items-center gap-2">
                                  <Badge variant="secondary" className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/40">Strava</Badge>
                                  Full Strava data (product development)
                                </h4>
                                {/* Athlete: all fields */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Athlete</h5>
                                    <div className="space-y-1 text-sm text-zinc-300">
                                      {pd.strava_snapshot.athlete && Object.entries(pd.strava_snapshot.athlete).map(([key, value]) => {
                                        if (value == null || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) return null;
                                        if (typeof value === 'object' && !Array.isArray(value)) return <p key={key}><span className="text-zinc-500">{key}:</span> [object]</p>;
                                        if (Array.isArray(value)) return <p key={key}><span className="text-zinc-500">{key}:</span> {value.length} items</p>;
                                        return <p key={key}><span className="text-zinc-500">{key}:</span> {String(value)}</p>;
                                      })}
                                    </div>
                                  </div>
                                </div>
                                {/* Activities: full table for where/how much they run */}
                                {pd.strava_snapshot.activities?.length > 0 && (
                                  <div className="space-y-2">
                                    <h5 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                      Activities ({pd.strava_snapshot.activities.length})
                                    </h5>
                                    <div className="overflow-x-auto -mx-2">
                                      <Table>
                                        <TableHeader>
                                          <TableRow className="border-zinc-700">
                                            <TableHead className="text-zinc-400">Name</TableHead>
                                            <TableHead className="text-zinc-400">Type</TableHead>
                                            <TableHead className="text-zinc-400">Distance</TableHead>
                                            <TableHead className="text-zinc-400">Moving</TableHead>
                                            <TableHead className="text-zinc-400">Elevation</TableHead>
                                            <TableHead className="text-zinc-400">Date</TableHead>
                                            <TableHead className="text-zinc-400">Avg speed</TableHead>
                                            <TableHead className="text-zinc-400">Map</TableHead>
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {pd.strava_snapshot.activities.map((act: any) => (
                                            <TableRow key={act.id} className="border-zinc-800">
                                              <TableCell className="text-zinc-300 text-sm font-medium max-w-[180px] truncate" title={act.name}>{act.name || '—'}</TableCell>
                                              <TableCell className="text-zinc-400 text-sm">{act.sport_type || act.type || '—'}</TableCell>
                                              <TableCell className="text-zinc-400 text-sm tabular-nums">{act.distance != null ? `${(act.distance / 1000).toFixed(2)} km` : '—'}</TableCell>
                                              <TableCell className="text-zinc-400 text-sm tabular-nums">{act.moving_time != null ? `${Math.floor(act.moving_time / 60)}m` : '—'}</TableCell>
                                              <TableCell className="text-zinc-400 text-sm tabular-nums">{act.total_elevation_gain != null ? `${act.total_elevation_gain} m` : '—'}</TableCell>
                                              <TableCell className="text-zinc-400 text-sm">{act.start_date_local ? new Date(act.start_date_local).toLocaleDateString(undefined, { dateStyle: 'short' }) : '—'}</TableCell>
                                              <TableCell className="text-zinc-400 text-sm tabular-nums">{act.average_speed != null ? `${(act.average_speed * 3.6).toFixed(1)} km/h` : '—'}</TableCell>
                                              <TableCell className="text-zinc-400 text-sm">
                                                {act.id ? (
                                                  <a href={`https://www.strava.com/activities/${act.id}`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">View</a>
                                                ) : act.map?.summary_polyline ? (
                                                  <span className="text-zinc-500" title="Polyline present">Route</span>
                                                ) : '—'}
                                              </TableCell>
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    </div>
                                    {/* Aggregates for product dev */}
                                    <div className="flex flex-wrap gap-4 pt-2 text-xs text-zinc-500">
                                      <span>Total distance: {(pd.strava_snapshot.activities.reduce((s: number, a: any) => s + (a.distance || 0), 0) / 1000).toFixed(1)} km</span>
                                      <span>Total moving time: {Math.round(pd.strava_snapshot.activities.reduce((s: number, a: any) => s + (a.moving_time || 0), 0) / 3600)} h</span>
                                      <span>Total elevation: {pd.strava_snapshot.activities.reduce((s: number, a: any) => s + (a.total_elevation_gain || 0), 0)} m</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                            <p className="col-span-full text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Profile details</p>
                            {/* Body & Physiology */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-zinc-400">Body & Physiology</h4>
                              <div className="space-y-1 text-sm text-zinc-300">
                                {(pd.fullName != null && pd.fullName !== '') && <p><span className="text-zinc-500">Full name:</span> {pd.fullName}</p>}
                                {pd.age != null && <p><span className="text-zinc-500">Age:</span> {pd.age}</p>}
                                {pd.sex && <p><span className="text-zinc-500">Sex:</span> {pd.sex}</p>}
                                {pd.weight != null && <p><span className="text-zinc-500">Weight:</span> {pd.weight} kg</p>}
                                {pd.height != null && <p><span className="text-zinc-500">Height:</span> {pd.height} cm</p>}
                                {pd.bodyFat != null && <p><span className="text-zinc-500">Body fat:</span> {pd.bodyFat}%</p>}
                                {pd.restingHeartRate != null && <p><span className="text-zinc-500">Resting HR:</span> {pd.restingHeartRate}</p>}
                                {pd.hrv != null && pd.hrv !== '' && <p><span className="text-zinc-500">HRV:</span> {pd.hrv}</p>}
                                {pd.healthConditions != null && pd.healthConditions !== '' && <p><span className="text-zinc-500">Health:</span> {pd.healthConditions}</p>}
                                {pd.sweatSodiumTest != null && <p><span className="text-zinc-500">Sweat sodium test:</span> {pd.sweatSodiumTest}</p>}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-zinc-400">Activity & terrain</h4>
                              <div className="space-y-1 text-sm text-zinc-300">
                                {pd.disciplines && pd.disciplines.length > 0 && <p><span className="text-zinc-500">Disciplines:</span> {pd.disciplines.join(', ')}</p>}
                                {pd.terrain != null && pd.terrain !== '' && <p><span className="text-zinc-500">Terrain:</span> {pd.terrain}</p>}
                                {pd.sessionDuration != null && <p><span className="text-zinc-500">Duration:</span> {(() => {
                                  const hours = pd.sessionDuration || 0;
                                  const h = Math.floor(hours);
                                  const m = Math.round((hours - h) * 60);
                                  return m > 0 ? `${h}h ${m}m` : `${h}h`;
                                })()}</p>}
                                {pd.indoorOutdoor && <p><span className="text-zinc-500">Location:</span> {pd.indoorOutdoor}</p>}
                                {pd.raceDistance != null && pd.raceDistance !== '' && <p><span className="text-zinc-500">Race distance:</span> {pd.raceDistance}</p>}
                                {pd.trainingDistance != null && pd.trainingDistance !== '' && <p><span className="text-zinc-500">Training distance:</span> {pd.trainingDistance}</p>}
                                {pd.goalTime != null && pd.goalTime !== '' && <p><span className="text-zinc-500">Goal time:</span> {pd.goalTime}</p>}
                                {pd.hasUpcomingRace != null && <p><span className="text-zinc-500">Has upcoming race:</span> {pd.hasUpcomingRace ? 'Yes' : 'No'}</p>}
                                {pd.avgPace != null && pd.avgPace !== '' && <p><span className="text-zinc-500">Avg pace:</span> {pd.avgPace}</p>}
                                {pd.swimPace != null && pd.swimPace !== '' && <p><span className="text-zinc-500">Swim pace:</span> {pd.swimPace}</p>}
                                {pd.swimDistance != null && pd.swimDistance !== '' && <p><span className="text-zinc-500">Swim distance:</span> {pd.swimDistance}</p>}
                                {pd.bikePower != null && pd.bikePower !== '' && <p><span className="text-zinc-500">Bike power:</span> {pd.bikePower}</p>}
                                {pd.bikeSpeed != null && pd.bikeSpeed !== '' && <p><span className="text-zinc-500">Bike speed:</span> {pd.bikeSpeed}</p>}
                                {pd.runPace != null && pd.runPace !== '' && <p><span className="text-zinc-500">Run pace:</span> {pd.runPace}</p>}
                                {pd.elevationGain != null && <p><span className="text-zinc-500">Elevation:</span> {pd.elevationGain} m</p>}
                                {pd.longestSession != null && <p><span className="text-zinc-500">Longest session:</span> {pd.longestSession} h</p>}
                                {pd.trainingFrequency != null && <p><span className="text-zinc-500">Frequency:</span> {pd.trainingFrequency}/week</p>}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-zinc-400">Environment</h4>
                              <div className="space-y-1 text-sm text-zinc-300">
                                {pd.trainingTempRange != null && <p><span className="text-zinc-500">Temp (training):</span> {pd.trainingTempRange.min}–{pd.trainingTempRange.max}°C</p>}
                                {pd.raceTempRange != null && <p><span className="text-zinc-500">Temp (race):</span> {pd.raceTempRange.min}–{pd.raceTempRange.max}°C</p>}
                                {pd.humidity != null && <p><span className="text-zinc-500">Humidity:</span> {pd.humidity}%</p>}
                                {pd.altitude != null && pd.altitude !== '' && <p><span className="text-zinc-500">Altitude:</span> {pd.altitude}</p>}
                                {pd.altitudeMeters != null && <p><span className="text-zinc-500">Altitude (m):</span> {pd.altitudeMeters} m</p>}
                                {pd.sunExposure != null && pd.sunExposure !== '' && <p><span className="text-zinc-500">Sun:</span> {pd.sunExposure}</p>}
                                {pd.windConditions != null && pd.windConditions !== '' && <p><span className="text-zinc-500">Wind:</span> {pd.windConditions}</p>}
                                {pd.clothingType != null && pd.clothingType !== '' && <p><span className="text-zinc-500">Clothing:</span> {pd.clothingType}</p>}
                                {pd.climate != null && pd.climate !== '' && <p><span className="text-zinc-500">Climate:</span> {pd.climate}</p>}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-zinc-400">Hydration & sweat</h4>
                              <div className="space-y-1 text-sm text-zinc-300">
                                {pd.sweatRate && <p><span className="text-zinc-500">Sweat rate:</span> {pd.sweatRate}</p>}
                                {pd.sweatSaltiness && <p><span className="text-zinc-500">Saltiness:</span> {pd.sweatSaltiness}</p>}
                                {pd.fluidIntake && <p><span className="text-zinc-500">Fluid Intake:</span> {pd.fluidIntake}L</p>}
                                {pd.urineColor && <p><span className="text-zinc-500">Urine Color:</span> {pd.urineColor}</p>}
                                {pd.crampTiming && <p><span className="text-zinc-500">Cramps:</span> {pd.crampTiming}</p>}
                                {pd.dehydrationSymptoms && pd.dehydrationSymptoms.length > 0 && (
                                  <p><span className="text-zinc-500">Symptoms:</span> {pd.dehydrationSymptoms.join(', ')}</p>
                                )}
                                {pd.hydrationStrategy && <p><span className="text-zinc-500">Strategy:</span> {pd.hydrationStrategy}</p>}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-zinc-400">Nutrition</h4>
                              <div className="space-y-1 text-sm text-zinc-300">
                                {pd.dailySaltIntake != null && pd.dailySaltIntake !== '' && <p><span className="text-zinc-500">Daily salt:</span> {pd.dailySaltIntake}</p>}
                                {pd.dailyWaterIntake != null && <p><span className="text-zinc-500">Daily water:</span> {pd.dailyWaterIntake} L</p>}
                                {pd.caffeineIntake != null && <p><span className="text-zinc-500">Caffeine:</span> {pd.caffeineIntake} mg</p>}
                                {pd.dietType != null && pd.dietType !== '' && <p><span className="text-zinc-500">Diet:</span> {pd.dietType}</p>}
                                {pd.specialDiet != null && pd.specialDiet !== '' && <p><span className="text-zinc-500">Special diet:</span> {pd.specialDiet}</p>}
                                {pd.fuelingStrategy != null && pd.fuelingStrategy !== '' && <p><span className="text-zinc-500">Fueling:</span> {pd.fuelingStrategy}</p>}
                                {pd.caffeineStrategy != null && pd.caffeineStrategy !== '' && <p><span className="text-zinc-500">Caffeine strategy:</span> {pd.caffeineStrategy}</p>}
                                {pd.preMealTiming != null && <p><span className="text-zinc-500">Pre-meal timing:</span> {pd.preMealTiming} h</p>}
                                {pd.recoveryWindow != null && <p><span className="text-zinc-500">Recovery window:</span> {pd.recoveryWindow} h</p>}
                                {pd.nutritionNotes != null && pd.nutritionNotes !== '' && <p><span className="text-zinc-500">Nutrition notes:</span> {pd.nutritionNotes}</p>}
                                {pd.otherSupplements != null && pd.otherSupplements !== '' && <p><span className="text-zinc-500">Supplements:</span> {pd.otherSupplements}</p>}
                              </div>
                            </div>

                            <div className="col-span-full order-first">
                              <FullHydrationPlanProtocol plan={plan} profile={pd} variant="user" />
                            </div>

                            {/* Sport-Specific Data (Football) */}
                            {(pd.position || pd.matchesPerWeek || pd.playingLevel) && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-zinc-400">Football</h4>
                                <div className="space-y-1 text-sm text-zinc-300">
                                  {pd.position && <p><span className="text-zinc-500">Position:</span> {pd.position}</p>}
                                  {pd.matchesPerWeek && <p><span className="text-zinc-500">Matches/Week:</span> {pd.matchesPerWeek}</p>}
                                  {pd.playingLevel && <p><span className="text-zinc-500">Level:</span> {pd.playingLevel}</p>}
                                  {pd.playingSurface && <p><span className="text-zinc-500">Surface:</span> {pd.playingSurface}</p>}
                                  {pd.avgDistanceCovered && <p><span className="text-zinc-500">Avg Distance:</span> {pd.avgDistanceCovered}km</p>}
                                </div>
                              </div>
                            )}

                            {/* Sport-Specific Data (Padel) */}
                            {(pd.padelPlayingLevel || pd.padelCourtType || pd.padelMatchesPerWeek) && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-zinc-400">Padel</h4>
                                <div className="space-y-1 text-sm text-zinc-300">
                                  {pd.padelPlayingLevel && <p><span className="text-zinc-500">Level:</span> {pd.padelPlayingLevel}</p>}
                                  {pd.padelCourtType && <p><span className="text-zinc-500">Court:</span> {pd.padelCourtType}</p>}
                                  {pd.padelPlayingStyle && <p><span className="text-zinc-500">Style:</span> {pd.padelPlayingStyle}</p>}
                                  {pd.padelMatchesPerWeek && <p><span className="text-zinc-500">Matches/Week:</span> {pd.padelMatchesPerWeek}</p>}
                                  {pd.padelTournamentPlay && <p><span className="text-zinc-500">Tournament:</span> Yes</p>}
                                </div>
                              </div>
                            )}

                            {/* Goals & Notes */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-zinc-400">Goals & notes</h4>
                              <div className="space-y-1 text-sm text-zinc-300">
                                {pd.primaryGoal != null && pd.primaryGoal !== '' && <p><span className="text-zinc-500">Primary goal:</span> {pd.primaryGoal}</p>}
                                {pd.performanceGoal != null && pd.performanceGoal !== '' && <p><span className="text-zinc-500">Performance goal:</span> {pd.performanceGoal}</p>}
                                {pd.targetEvents != null && pd.targetEvents !== '' && <p><span className="text-zinc-500">Target events:</span> {pd.targetEvents}</p>}
                                {pd.upcomingEvents != null && pd.upcomingEvents !== '' && <p><span className="text-zinc-500">Upcoming events:</span> {pd.upcomingEvents}</p>}
                                {pd.pastIssues != null && pd.pastIssues !== '' && <p><span className="text-zinc-500">Past issues:</span> {pd.pastIssues}</p>}
                                {pd.specificConcerns != null && pd.specificConcerns !== '' && <p><span className="text-zinc-500">Concerns:</span> {pd.specificConcerns}</p>}
                                {pd.otherNotes != null && pd.otherNotes !== '' && <p><span className="text-zinc-500">Notes:</span> {pd.otherNotes}</p>}
                              </div>
                            </div>

                            {/* Sleep & Recovery */}
                            {(pd.sleepHours != null || pd.sleepQuality != null || pd.weeklyVolume != null) && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-zinc-400">Sleep & recovery</h4>
                                <div className="space-y-1 text-sm text-zinc-300">
                                  {pd.sleepHours != null && <p><span className="text-zinc-500">Sleep:</span> {pd.sleepHours} h</p>}
                                  {pd.sleepQuality != null && <p><span className="text-zinc-500">Sleep quality:</span> {pd.sleepQuality}/10</p>}
                                  {pd.weeklyVolume != null && <p><span className="text-zinc-500">Weekly volume:</span> {pd.weeklyVolume} h</p>}
                                </div>
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}