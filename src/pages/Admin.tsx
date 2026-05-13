import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, LogOut, Trash2, Users, Database, Activity, ChevronDown, ChevronRight, FileDown, Zap, RefreshCw, Search, X, ImageDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { generateFuelPlanImage } from '@/components/ShareCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SupplmeIcon, SupplmeWordmark } from '@/components/SupplmeBrandAssets';
import { jsPDF } from 'jspdf';

function fmtDuration(hours: number) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ActivityDetailCard({ activity }: { activity: any }) {
  if (!activity) return null;
  const distanceCounts = new Map<string, number>();
  (activity.distances as string[]).forEach((d) => distanceCounts.set(d, (distanceCounts.get(d) || 0) + 1));
  const sortedDistances = Array.from(distanceCounts.entries()).sort((a, b) => b[1] - a[1]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="space-y-2">
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Mode</h4>
        <div className="flex justify-between rounded-lg bg-secondary border border-border p-3">
          <span className="text-xs text-muted-foreground">Race</span>
          <span className="font-bold tabular-nums">{activity.raceDayCount}</span>
        </div>
        <div className="flex justify-between rounded-lg bg-secondary border border-border p-3">
          <span className="text-xs text-muted-foreground">Training</span>
          <span className="font-bold tabular-nums">{activity.trainingCount}</span>
        </div>
      </div>
      <div className="md:col-span-2 space-y-2">
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground">Distances</h4>
        <div className="grid grid-cols-2 gap-2">
          {sortedDistances.slice(0, 8).map(([distance, count]) => (
            <div key={distance} className="flex justify-between items-center rounded-lg bg-secondary border border-border px-3 py-2">
              <span className="text-xs text-secondary-foreground truncate">{distance || '—'}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{count}x</span>
            </div>
          ))}
          {sortedDistances.length === 0 && <p className="text-xs text-muted-foreground col-span-2">No distance data</p>}
        </div>
      </div>
    </div>
  );
}

function FuelPlanResultCard({ plan, pd }: { plan: any; pd: any }) {
  if (!plan?.preActivity) return null;
  const effectiveDur = Math.max(0, (pd.sessionDuration || 0) - 0.5);
  const duringTotal = plan.duringActivity?.totalElectrolytes
    ?? Math.round((plan.duringActivity?.electrolytesPerHour || 0) * effectiveDur);
  const gel = plan.energyGel;
  const gelApplicable = gel?.applicable && gel?.totalGels > 0;
  const carbsPerHour = gelApplicable && gel.gelsPerHour > 0 ? Math.round(gel.gelsPerHour * 32) : null;
  const durLabel = fmtDuration(pd.sessionDuration || 0);
  return (
    <div className="mb-6 border border-black/10">
      <div className="px-4 py-2 bg-[#CBD0D6] flex flex-wrap items-baseline gap-3">
        <span className="font-mono text-[9px] tracking-[2px] uppercase font-semibold text-[#0A0A0A]">Fuel Plan Result</span>
        {pd.disciplines?.[0] && <span className="font-mono text-[9px] text-[#0A0A0A]/60">{pd.disciplines.join(' / ')}</span>}
        {(pd.raceDistance || pd.trainingDistance) && <span className="font-mono text-[9px] font-bold text-[#0A0A0A]">{pd.raceDistance || pd.trainingDistance}</span>}
        {pd.hasUpcomingRace && <span className="font-mono text-[9px] uppercase tracking-wide text-[#0A0A0A]">· Race day</span>}
        {pd.sessionDuration && <span className="font-mono text-[9px] text-[#0A0A0A]/60">{durLabel}</span>}
      </div>
      <div className="px-4 pt-3 pb-1">
        <p className="font-mono text-[8.5px] tracking-[1.8px] uppercase text-[#8A9099]">Electrolytes</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-black/10 border-t border-black/10">
        <div className="px-4 py-3">
          <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#8A9099] mb-1">Fluid loss</div>
          <div className="font-display font-bold text-[22px] leading-none tabular-nums text-[#0A0A0A]">{((plan.totalFluidLoss || 0) / 1000).toFixed(1)}L</div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#8A9099] mb-1">Pre-activity</div>
          <div className="font-display font-bold text-[22px] leading-none tabular-nums text-[#0A0A0A]">{plan.preActivity.electrolytes}×</div>
          <div className="font-mono text-[9px] text-[#8A9099] mt-0.5">{plan.preActivity.water}ml water</div>
        </div>
        <div className="px-4 py-3 bg-[#0A0A0A]">
          <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-white/50 mb-1">During</div>
          <div className="font-display font-bold text-[22px] leading-none tabular-nums text-white">{duringTotal}×</div>
          <div className="font-mono text-[9px] text-white/50 mt-0.5">{plan.duringActivity?.electrolytesPerHour ?? 0}<span>/hr · </span>{plan.duringActivity?.waterPerHour ?? 0}<span>ml/hr</span></div>
        </div>
        <div className="px-4 py-3">
          <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#8A9099] mb-1">Post-activity</div>
          <div className="font-display font-bold text-[22px] leading-none tabular-nums text-[#0A0A0A]">{plan.postActivity?.electrolytes ?? 0}×</div>
          <div className="font-mono text-[9px] text-[#8A9099] mt-0.5">{plan.postActivity?.water ?? 0}ml water</div>
        </div>
      </div>
      {gelApplicable && (
        <div className="border-t border-black/10">
          <div className="px-4 pt-3 pb-1">
            <p className="font-mono text-[8.5px] tracking-[1.8px] uppercase text-[#8A9099]">Carbohydrates</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-black/10 border-t border-black/10">
            <div className="px-4 py-3">
              <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#8A9099] mb-1">Total gels</div>
              <div className="font-display font-bold text-[22px] leading-none tabular-nums text-[#0A0A0A]">{gel.totalGels}×</div>
            </div>
            <div className="px-4 py-3">
              <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#8A9099] mb-1">Total carbs</div>
              <div className="font-display font-bold text-[22px] leading-none tabular-nums text-[#0A0A0A]">{gel.totalCarbsG}g</div>
            </div>
            <div className="px-4 py-3 bg-[#0A0A0A]">
              <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-white/50 mb-1">Carbs / hr</div>
              <div className="font-display font-bold text-[22px] leading-none tabular-nums text-white">{carbsPerHour}g</div>
            </div>
            <div className="px-4 py-3">
              <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#8A9099] mb-1">Total kcal</div>
              <div className="font-display font-bold text-[22px] leading-none tabular-nums text-[#0A0A0A]">{gel.totalKcal}</div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-3 px-4 py-2.5 border-t border-black/10 bg-[#F7F8F9]">
        {plan.confidenceScore != null && <span className="font-mono text-[9px] text-[#8A9099]">Confidence: {plan.confidenceScore}<span>/5</span></span>}
        {plan.activeDataSources?.length > 0 && <span className="font-mono text-[9px] text-[#8A9099]">Sources: {plan.activeDataSources.join(', ')}</span>}
      </div>
    </div>
  );
}
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
    weeklySubmissions: [] as { week: string; count: number }[],
  });
  const [accountStats, setAccountStats] = useState({
    totalAccounts: 0,
    activatedAccounts: 0,
    retainedAccounts: 0,
    accountsByWeek: [] as { week: string; count: number }[],
  });
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);

  const [expandedStrava, setExpandedStrava] = useState<Set<string>>(new Set());
  const toggleStrava = (id: string) => {
    const next = new Set(expandedStrava);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedStrava(next);
  };

  // Mass selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProfiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProfiles.map((p) => p.id)));
    }
  };
  const massDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} submission${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from('hydration_profiles')
        .delete()
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      setSelectedIds(new Set());
      toast({ title: `${selectedIds.size} submissions deleted` });
      await loadProfiles();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  // Submission filters
  const [filterSearch, setFilterSearch] = useState('');
  const [filterDiscipline, setFilterDiscipline] = useState('');
  const [filterSmartwatch, setFilterSmartwatch] = useState<'all' | 'yes' | 'no'>('all');
  const [filterStrava, setFilterStrava] = useState<'all' | 'yes' | 'no'>('all');
  const navigate = useNavigate();
  const { toast } = useToast();

  const filteredProfiles = profiles.filter((profile) => {
    const pd = profile.profile_data || {};
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      const name = (pd.fullName || '').toLowerCase();
      const email = (profile.user_email || '').toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    if (filterDiscipline) {
      const disciplines: string[] = pd.disciplines || [];
      if (!disciplines.some((d: string) => d === filterDiscipline)) return false;
    }
    if (filterSmartwatch === 'yes' && !profile.has_smartwatch_data) return false;
    if (filterSmartwatch === 'no' && profile.has_smartwatch_data) return false;
    if (filterStrava === 'yes' && !pd.strava_snapshot) return false;
    if (filterStrava === 'no' && pd.strava_snapshot) return false;
    return true;
  });

  const allDisciplines = Array.from(
    new Set(profiles.flatMap((p) => (p.profile_data?.disciplines as string[] | undefined) || []))
  ).sort();

  const hasActiveFilters = filterSearch || filterDiscipline || filterSmartwatch !== 'all' || filterStrava !== 'all';

  const clearFilters = () => {
    setFilterSearch('');
    setFilterDiscipline('');
    setFilterSmartwatch('all');
    setFilterStrava('all');
  };

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
    const html = document.documentElement;
    const wasDark = html.classList.contains('dark');
    html.classList.remove('dark');
    return () => {
      if (wasDark) html.classList.add('dark');
    };
  }, []);

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
      await Promise.all([loadProfiles(), loadAccountStats()]);
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

      // Weekly submissions: group by ISO week (Mon–Sun), last 16 weeks
      const weekMap = new Map<string, number>();
      data?.forEach((p: any) => {
        const d = new Date(p.created_at);
        // Get Monday of that week
        const day = d.getDay(); // 0=Sun
        const diff = (day === 0 ? -6 : 1 - day);
        const mon = new Date(d);
        mon.setDate(d.getDate() + diff);
        mon.setHours(0, 0, 0, 0);
        const key = mon.toISOString().slice(0, 10); // YYYY-MM-DD
        weekMap.set(key, (weekMap.get(key) || 0) + 1);
      });
      const weeklySubmissions = Array.from(weekMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-16)
        .map(([dateStr, count]) => {
          const d = new Date(dateStr);
          const label = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
          return { week: label, count };
        });

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
        weeklySubmissions,
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

  const loadAccountStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_account_stats');
      if (error) throw error;

      const raw = data as any;
      const byWeek: { week: string; count: number }[] = (raw.accounts_by_week || [])
        .slice(-16)
        .map((row: any) => {
          const d = new Date(row.week_start);
          return {
            week: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
            count: Number(row.count),
          };
        });

      setAccountStats({
        totalAccounts: Number(raw.total_accounts ?? 0),
        activatedAccounts: Number(raw.activated_accounts ?? 0),
        retainedAccounts: Number(raw.retained_accounts ?? 0),
        accountsByWeek: byWeek,
      });
    } catch (error: any) {
      console.error('Error loading account stats:', error);
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
    // totalElectrolytes was missing from saved records before a schema fix —
    // fall back to electrolytesPerHour × effective duration for old records.
    const effectiveDurPdf = Math.max(0, (pd.sessionDuration || 0) - 0.5);
    const pdfDuringSachets: number =
      plan.duringActivity?.totalElectrolytes != null
        ? plan.duringActivity.totalElectrolytes
        : Math.round((plan.duringActivity?.electrolytesPerHour || 0) * effectiveDurPdf);
    const pdfIntervalMin =
      plan.duringActivity?.electrolytesPerHour > 0
        ? Math.round(60 / plan.duringActivity.electrolytesPerHour)
        : 0;

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
    doc.text(
      `Supplme Sachets: ${pdfDuringSachets} sachet${pdfDuringSachets !== 1 ? 's' : ''} total` +
      (pdfIntervalMin > 0 ? ` (1 every ${pdfIntervalMin} min)` : ''),
      margin + 5, y
    );

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
      doc.text('RACE DAY FUEL PLAN', pageWidth / 2, y, { align: 'center' });
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

  const downloadPlanImage = async (profile: HydrationProfileData) => {
    const pd = profile.profile_data || {};
    const plan = profile.plan_data || {};
    try {
      const distanceStr = pd.raceDistance || '';
      const distanceKm = parseFloat(distanceStr) || 0;
      const blob = await generateFuelPlanImage(plan, pd, distanceKm, null);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `supplme-plan-${pd.fullName?.replace(/\s+/g, '-').toLowerCase() || profile.id}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Image Downloaded", description: `Plan image for ${pd.fullName || 'user'} saved.` });
    } catch (err: any) {
      toast({ title: "Download Failed", description: err.message, variant: "destructive" });
    }
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-[#0A0A0A] p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center pb-4 border-b border-black/10">
          <div className="flex items-center gap-2.5">
            <SupplmeIcon size={22} />
            <SupplmeWordmark height={14} />
            <span className="font-mono text-[9px] tracking-[1.8px] text-[#8A9099] uppercase ml-3">Admin / Data Center</span>
          </div>
          <button onClick={handleLogout} className="font-mono text-[9px] tracking-[1.5px] uppercase text-[#8A9099] hover:text-[#0A0A0A] border border-black/10 px-3 py-1.5 transition-colors flex items-center gap-1.5">
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </header>

        {/* Key metrics strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 bg-[#CBD0D6]">
          <div className="px-4 py-3.5">
            <div className="font-display font-bold text-[26px] leading-none tabular-nums text-[#0A0A0A]">{stats.total}</div>
            <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#0A0A0A]/55 mt-1">Submissions</div>
          </div>
          <div className="px-4 py-3.5 border-l border-black/10">
            <div className="font-display font-bold text-[26px] leading-none tabular-nums text-[#0A0A0A]">{stats.withSmartwatch}</div>
            <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#0A0A0A]/55 mt-1">Smartwatch</div>
          </div>
          <div className="px-4 py-3.5 border-l border-black/10">
            <div className="font-display font-bold text-[26px] leading-none tabular-nums text-[#0A0A0A]">{(stats.avgFluidLossMl / 1000).toFixed(1)}L</div>
            <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#0A0A0A]/55 mt-1">Avg fluid loss</div>
          </div>
          <div className="px-4 py-3.5 border-l border-black/10">
            <div className="font-display font-bold text-[26px] leading-none tabular-nums text-[#0A0A0A]">{stats.avgElectrolytesPerHour}</div>
            <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#0A0A0A]/55 mt-1">Avg sachets/hr</div>
          </div>
          <div className="px-4 py-3.5 border-l border-black/10">
            <div className="font-display font-bold text-[26px] leading-none tabular-nums text-[#0A0A0A]">{stats.avgSodiumLossPerHourMg}mg</div>
            <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#0A0A0A]/55 mt-1">Avg Na loss/hr</div>
          </div>
          <div className="px-4 py-3.5 border-l border-black/10">
            <div className="font-display font-bold text-[26px] leading-none tabular-nums text-[#0A0A0A]">{stats.averageAge}y</div>
            <div className="font-mono text-[8.5px] tracking-[1.2px] uppercase text-[#0A0A0A]/55 mt-1">Avg age</div>
          </div>
        </div>

        {/* Accounts & Retention */}
        <div className="border border-black/10 overflow-hidden">
          <div className="px-4 py-2.5 bg-[#0A0A0A]">
            <h2 className="font-mono text-[9px] tracking-[2px] uppercase text-white font-semibold">Accounts & Retention</h2>
          </div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-secondary border border-brand-green/20 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Accounts</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5 text-brand-green">{accountStats.totalAccounts}</p>
                <p className="text-[10px] text-muted-foreground mt-1">registered</p>
              </div>
              <div className="rounded-lg bg-secondary border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Activated</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{accountStats.activatedAccounts}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {accountStats.totalAccounts > 0
                    ? `${Math.round((accountStats.activatedAccounts / accountStats.totalAccounts) * 100)}% of accounts`
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-secondary border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Retained</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{accountStats.retainedAccounts}</p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {accountStats.activatedAccounts > 0
                    ? `${Math.round((accountStats.retainedAccounts / accountStats.activatedAccounts) * 100)}% of activated`
                    : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-secondary border border-border p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Anon plans</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5">{stats.total - accountStats.activatedAccounts > 0 ? stats.total - accountStats.activatedAccounts : '—'}</p>
                <p className="text-[10px] text-muted-foreground mt-1">no account linked</p>
              </div>
            </div>

            {/* New accounts per week chart */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">New accounts per week</p>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={accountStats.accountsByWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-35} textAnchor="end" height={55} />
                  <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} width={28} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="count" fill="hsl(142, 72%, 29%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Product development */}
        <div className="border border-black/10 overflow-hidden">
          <div className="px-4 py-2.5 bg-[#0A0A0A]">
            <h2 className="font-mono text-[9px] tracking-[2px] uppercase text-white font-semibold">Product Development</h2>
          </div>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            <div className="rounded-lg bg-secondary border border-product-warm/15 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg fluid loss</p>
              <p className="text-xl font-bold tabular-nums text-product-warm">{(stats.avgFluidLossMl / 1000).toFixed(1)} L</p>
              <p className="text-[10px] text-muted-foreground mt-1">per session (n={stats.totalWithPlan})</p>
            </div>
            <div className="rounded-lg bg-secondary border border-brand-red/15 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg sodium loss/hr</p>
              <p className="text-xl font-bold tabular-nums text-brand-red">{stats.avgSodiumLossPerHourMg} mg</p>
              <p className="text-[10px] text-muted-foreground mt-1">estimated from sweat saltiness</p>
            </div>
            <div className="rounded-lg bg-secondary border border-product-warm/15 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg electrolytes/hr</p>
              <p className="text-xl font-bold tabular-nums text-product-warm">{stats.avgElectrolytesPerHour} sachets</p>
              <p className="text-[10px] text-muted-foreground mt-1">during activity</p>
            </div>
            <div className="rounded-lg bg-secondary border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg water/hr</p>
              <p className="text-xl font-bold tabular-nums">{stats.avgWaterPerHourDuring} ml</p>
              <p className="text-[10px] text-muted-foreground mt-1">during activity</p>
            </div>
            <div className="rounded-lg bg-secondary border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg session</p>
              <p className="text-xl font-bold tabular-nums">{stats.avgSessionDurationHours} h</p>
              <p className="text-[10px] text-muted-foreground mt-1">duration</p>
            </div>
            <div className="rounded-lg bg-secondary border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sweat rate</p>
              <div className="flex gap-2 mt-1.5 text-xs">
                <span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green border border-brand-green/20">L: {stats.sweatRateDistribution.low}</span>
                <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">M: {stats.sweatRateDistribution.medium}</span>
                <span className="px-2 py-0.5 rounded bg-brand-red/10 text-brand-red border border-brand-red/20">H: {stats.sweatRateDistribution.high}</span>
              </div>
            </div>
            <div className="rounded-lg bg-secondary border border-border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sweat saltiness</p>
              <div className="flex gap-2 mt-1.5 text-xs">
                <span className="px-2 py-0.5 rounded bg-brand-green/10 text-brand-green border border-brand-green/20">L: {stats.sweatSaltinessDistribution.low}</span>
                <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">M: {stats.sweatSaltinessDistribution.medium}</span>
                <span className="px-2 py-0.5 rounded bg-brand-red/10 text-brand-red border border-brand-red/20">H: {stats.sweatSaltinessDistribution.high}</span>
              </div>
            </div>
            <div className="rounded-lg bg-secondary border border-product-warm/20 p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Strava-linked users</p>
              <p className="text-xl font-bold tabular-nums text-product-warm">{stats.withStrava}</p>
              <p className="text-[10px] text-muted-foreground mt-1">avg {stats.avgStravaActivitiesPerUser.toFixed(1)} activities imported</p>
            </div>
          </div>
        </div>

        {/* Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border border-l-4 border-l-product-warm bg-card p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Gender</h3>
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
                  <Cell fill="hsl(199, 89%, 48%)" />
                  <Cell fill="hsl(0, 72%, 51%)" />
                  <Cell fill="hsl(0, 0%, 75%)" />
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-product-cool">M {stats.genderDistribution.male}</span>
              <span className="text-brand-red">F {stats.genderDistribution.female}</span>
              <span className="text-chrome">O {stats.genderDistribution.other}</span>
            </div>
          </div>

          <div className="rounded-xl border border-border border-l-4 border-l-product-warm bg-card p-4 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Avg sodium loss / hr</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.sodiumLossBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="avgMg" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground">
              n={stats.sodiumLossBuckets.reduce((sum, b) => sum + b.count, 0)} profiles
            </p>
          </div>

          <div className="rounded-xl border border-border border-l-4 border-l-brand-green bg-card p-4 shadow-sm lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Weekly submissions</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.weeklySubmissions}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} angle={-35} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="hsl(142, 72%, 29%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-xs text-muted-foreground">Last {stats.weeklySubmissions.length} weeks · week starts Monday</p>
          </div>

          <div className="rounded-xl border border-border border-l-4 border-l-brand-red bg-card p-4 shadow-sm lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Activities (click bar)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.activityStats.slice(0, 6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="activity" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} angle={-35} textAnchor="end" height={60} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="count" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} onClick={(data) => setSelectedActivity(data.activity)} className="cursor-pointer hover:opacity-90" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {selectedActivity && (
            <div className="rounded-xl border border-border border-t-4 border-t-product-warm bg-card p-4 shadow-sm lg:col-span-3">
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-sm font-semibold">{selectedActivity}</h3>
                <Button variant="ghost" size="sm" onClick={() => setSelectedActivity(null)} className="text-muted-foreground hover:text-destructive">
                  Close
                </Button>
              </div>
              <ActivityDetailCard activity={stats.activityStats.find(a => a.activity === selectedActivity)} />
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadAllDataCSV} size="sm" className="gap-2 bg-product-warm/15 border border-product-warm/30 text-product-warm hover:bg-product-warm/25">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button onClick={loadProfiles} variant="outline" size="sm" className="gap-2 border-border text-muted-foreground hover:bg-secondary hover:border-product-warm/30 hover:text-product-warm">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>

        <div className="border border-black/10 overflow-hidden">
          <div className="px-4 py-2.5 bg-[#0A0A0A]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono text-[9px] tracking-[2px] uppercase text-white font-semibold">User Submissions</h2>
                <p className="font-mono text-[8px] tracking-[1px] uppercase text-white/40 mt-0.5">
                  {hasActiveFilters ? `${filteredProfiles.length} of ${profiles.length}` : profiles.length} submission{profiles.length !== 1 ? 's' : ''} — expand to see full fuel plan
                </p>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground hover:text-destructive gap-1">
                  <X className="w-3 h-3" /> Clear filters
                </Button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Name or email…"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="pl-7 h-8 text-xs w-48 bg-background border-border"
                />
              </div>
              <select
                value={filterDiscipline}
                onChange={(e) => setFilterDiscipline(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All disciplines</option>
                {allDisciplines.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={filterSmartwatch}
                onChange={(e) => setFilterSmartwatch(e.target.value as 'all' | 'yes' | 'no')}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">Smartwatch: all</option>
                <option value="yes">Smartwatch: yes</option>
                <option value="no">Smartwatch: no</option>
              </select>
              <select
                value={filterStrava}
                onChange={(e) => setFilterStrava(e.target.value as 'all' | 'yes' | 'no')}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">Strava: all</option>
                <option value="yes">Strava: yes</option>
                <option value="no">Strava: no</option>
              </select>
            </div>
          </div>
          <div className="p-4">
            {/* Mass-delete toolbar */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-sm font-medium text-destructive">{selectedIds.size} selected</span>
                <button
                  onClick={massDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold hover:bg-destructive/90 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete selected
                </button>
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear selection
                </button>
              </div>
            )}
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading...</p>
            ) : profiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data yet.</p>
            ) : filteredProfiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No submissions match the current filters.</p>
            ) : (
              <div className="space-y-2">
                {/* Select-all row */}
                <div className="flex items-center gap-2 px-1 pb-1 border-b border-border">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredProfiles.length && filteredProfiles.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">Select all ({filteredProfiles.length})</span>
                </div>
                {filteredProfiles.map((profile) => {
                  const pd = profile.profile_data || {};
                  const plan = profile.plan_data || {};
                  const isExpanded = expandedRows.has(profile.id);

                  return (
                    <div key={profile.id} className={`rounded-lg border bg-card p-4 border-l-4 transition-colors shadow-sm ${selectedIds.has(profile.id) ? 'border-destructive/40 border-l-destructive bg-destructive/5' : 'border-border border-l-chrome hover:border-l-product-warm'}`}>
                      <Collapsible open={isExpanded} onOpenChange={() => toggleRow(profile.id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(profile.id)}
                              onChange={() => toggleSelect(profile.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded border-border cursor-pointer flex-shrink-0"
                            />
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="p-1 text-muted-foreground hover:text-foreground">
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            </CollapsibleTrigger>

                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 flex-1">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Date</p>
                                <p className="text-sm font-medium tabular-nums">{new Date(profile.created_at).toLocaleDateString()}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Name</p>
                                <p className="text-sm font-medium">{pd.fullName || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Email</p>
                                <p className="text-sm font-medium truncate max-w-[140px]">{profile.user_email || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Discipline</p>
                                <p className="text-sm font-medium">{pd.disciplines?.[0] || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Race</p>
                                <p className="text-sm font-medium truncate max-w-[140px]">{pd.raceName || pd.raceDistance || '—'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Age / Sex</p>
                                <p className="text-sm font-medium tabular-nums">{pd.age || '?'} / {pd.sex || '?'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Watch</p>
                                {profile.has_smartwatch_data ? (
                                  <span className="text-xs text-brand-green">Yes</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No</span>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Strava</p>
                                {pd.strava_snapshot ? (
                                  <Badge variant="secondary" className="text-[10px] bg-product-warm/20 text-product-warm border-product-warm/40">
                                    Yes
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No</span>
                                )}
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Consent</p>
                                {profile.consent_given ? (
                                  <span className="text-xs text-brand-green">✓</span>
                                ) : (
                                  <span className="text-xs text-brand-red">✗</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                onClick={() => downloadPlanImage(profile)}
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                                title="Download plan image (same as user gets)"
                              >
                                <ImageDown className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => downloadUserGuide(profile)}
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                                title="Download PDF guide"
                              >
                                <FileDown className="w-4 h-4" />
                              </Button>
                              <Button
                                onClick={() => deleteProfile(profile.id)}
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <CollapsibleContent className="mt-4 pt-4 border-t border-black/10">
                          {/* ── Fuel Plan Result ── */}
                          <FuelPlanResultCard plan={plan} pd={pd} />

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pd.strava_snapshot && (
                              <div className="col-span-full mb-4">
                                <button
                                  onClick={() => toggleStrava(profile.id)}
                                  className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-product-warm-muted border border-product-warm/20 hover:bg-product-warm/10 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="text-[10px] bg-product-warm/20 text-product-warm border-product-warm/40">Strava</Badge>
                                    <span className="text-sm font-medium text-product-warm">Full Strava data</span>
                                    {pd.strava_snapshot.activities?.length > 0 && (
                                      <span className="text-xs text-muted-foreground">({pd.strava_snapshot.activities.length} activities)</span>
                                    )}
                                  </div>
                                  {expandedStrava.has(profile.id)
                                    ? <ChevronDown className="w-4 h-4 text-product-warm" />
                                    : <ChevronRight className="w-4 h-4 text-product-warm" />
                                  }
                                </button>
                                {expandedStrava.has(profile.id) && (
                                  <div className="mt-2 p-4 rounded-lg bg-product-warm-muted border border-product-warm/20 space-y-4">
                                    {/* Athlete: all fields */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                      <div className="space-y-2">
                                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Athlete</h5>
                                        <div className="space-y-1 text-sm text-foreground">
                                          {pd.strava_snapshot.athlete && Object.entries(pd.strava_snapshot.athlete).map(([key, value]) => {
                                            if (value == null || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) return null;
                                            if (typeof value === 'object' && !Array.isArray(value)) return <p key={key}><span className="text-muted-foreground">{key}:</span> [object]</p>;
                                            if (Array.isArray(value)) return <p key={key}><span className="text-muted-foreground">{key}:</span> {value.length} items</p>;
                                            return <p key={key}><span className="text-muted-foreground">{key}:</span> {String(value)}</p>;
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                    {/* Activities table */}
                                    {pd.strava_snapshot.activities?.length > 0 && (
                                      <div className="space-y-2">
                                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                          Activities ({pd.strava_snapshot.activities.length})
                                        </h5>
                                        <div className="overflow-x-auto -mx-2">
                                          <Table>
                                            <TableHeader>
                                              <TableRow className="border-border">
                                                <TableHead className="text-muted-foreground">Name</TableHead>
                                                <TableHead className="text-muted-foreground">Type</TableHead>
                                                <TableHead className="text-muted-foreground">Distance</TableHead>
                                                <TableHead className="text-muted-foreground">Moving</TableHead>
                                                <TableHead className="text-muted-foreground">Elevation</TableHead>
                                                <TableHead className="text-muted-foreground">Date</TableHead>
                                                <TableHead className="text-muted-foreground">Avg speed</TableHead>
                                                <TableHead className="text-muted-foreground">Map</TableHead>
                                              </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                              {pd.strava_snapshot.activities.map((act: any) => (
                                                <TableRow key={act.id} className="border-border">
                                                  <TableCell className="text-foreground text-sm font-medium max-w-[180px] truncate" title={act.name}>{act.name || '—'}</TableCell>
                                                  <TableCell className="text-muted-foreground text-sm">{act.sport_type || act.type || '—'}</TableCell>
                                                  <TableCell className="text-muted-foreground text-sm tabular-nums">{act.distance != null ? `${(act.distance / 1000).toFixed(2)} km` : '—'}</TableCell>
                                                  <TableCell className="text-muted-foreground text-sm tabular-nums">{act.moving_time != null ? `${Math.floor(act.moving_time / 60)}m` : '—'}</TableCell>
                                                  <TableCell className="text-muted-foreground text-sm tabular-nums">{act.total_elevation_gain != null ? `${act.total_elevation_gain} m` : '—'}</TableCell>
                                                  <TableCell className="text-muted-foreground text-sm">{act.start_date_local ? new Date(act.start_date_local).toLocaleDateString(undefined, { dateStyle: 'short' }) : '—'}</TableCell>
                                                  <TableCell className="text-muted-foreground text-sm tabular-nums">{act.average_speed != null ? `${(act.average_speed * 3.6).toFixed(1)} km/h` : '—'}</TableCell>
                                                  <TableCell className="text-muted-foreground text-sm">
                                                    {act.id ? (
                                                      <a href={`https://www.strava.com/activities/${act.id}`} target="_blank" rel="noopener noreferrer" className="text-product-warm hover:underline">View</a>
                                                    ) : act.map?.summary_polyline ? (
                                                      <span className="text-muted-foreground" title="Polyline present">Route</span>
                                                    ) : '—'}
                                                  </TableCell>
                                                </TableRow>
                                              ))}
                                            </TableBody>
                                          </Table>
                                        </div>
                                        <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted-foreground">
                                          <span>Total distance: {(pd.strava_snapshot.activities.reduce((s: number, a: any) => s + (a.distance || 0), 0) / 1000).toFixed(1)} km</span>
                                          <span>Total moving time: {Math.round(pd.strava_snapshot.activities.reduce((s: number, a: any) => s + (a.moving_time || 0), 0) / 3600)} h</span>
                                          <span>Total elevation: {pd.strava_snapshot.activities.reduce((s: number, a: any) => s + (a.total_elevation_gain || 0), 0)} m</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            <p className="col-span-full text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Profile details</p>
                            {/* Body & Physiology */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-muted-foreground">Body & Physiology</h4>
                              <div className="space-y-1 text-sm text-foreground">
                                {(pd.fullName != null && pd.fullName !== '') && <p><span className="text-muted-foreground">Full name:</span> {pd.fullName}</p>}
                                {pd.age != null && <p><span className="text-muted-foreground">Age:</span> {pd.age}</p>}
                                {pd.sex && <p><span className="text-muted-foreground">Sex:</span> {pd.sex}</p>}
                                {pd.weight != null && <p><span className="text-muted-foreground">Weight:</span> {pd.weight} kg</p>}
                                {pd.height != null && <p><span className="text-muted-foreground">Height:</span> {pd.height} cm</p>}
                                {pd.bodyFat != null && <p><span className="text-muted-foreground">Body fat:</span> {pd.bodyFat}%</p>}
                                {pd.restingHeartRate != null && <p><span className="text-muted-foreground">Resting HR:</span> {pd.restingHeartRate}</p>}
                                {pd.hrv != null && pd.hrv !== '' && <p><span className="text-muted-foreground">HRV:</span> {pd.hrv}</p>}
                                {pd.healthConditions != null && pd.healthConditions !== '' && <p><span className="text-muted-foreground">Health:</span> {pd.healthConditions}</p>}
                                {pd.sweatSodiumTest != null && <p><span className="text-muted-foreground">Sweat sodium test:</span> {pd.sweatSodiumTest}</p>}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-muted-foreground">Activity & terrain</h4>
                              <div className="space-y-1 text-sm text-foreground">
                                {pd.disciplines && pd.disciplines.length > 0 && <p><span className="text-muted-foreground">Disciplines:</span> {pd.disciplines.join(', ')}</p>}
                                {pd.terrain != null && pd.terrain !== '' && <p><span className="text-muted-foreground">Terrain:</span> {pd.terrain}</p>}
                                {pd.sessionDuration != null && <p><span className="text-muted-foreground">Duration:</span> {fmtDuration(pd.sessionDuration || 0)}</p>}
                                {pd.indoorOutdoor && <p><span className="text-muted-foreground">Location:</span> {pd.indoorOutdoor}</p>}
                                {pd.raceDistance != null && pd.raceDistance !== '' && <p><span className="text-muted-foreground">Race distance:</span> {pd.raceDistance}</p>}
                                {pd.trainingDistance != null && pd.trainingDistance !== '' && <p><span className="text-muted-foreground">Training distance:</span> {pd.trainingDistance}</p>}
                                {pd.goalTime != null && pd.goalTime !== '' && <p><span className="text-muted-foreground">Goal time:</span> {pd.goalTime}</p>}
                                {pd.hasUpcomingRace != null && <p><span className="text-muted-foreground">Has upcoming race:</span> {pd.hasUpcomingRace ? 'Yes' : 'No'}</p>}
                                {pd.avgPace != null && pd.avgPace !== '' && <p><span className="text-muted-foreground">Avg pace:</span> {pd.avgPace}</p>}
                                {pd.swimPace != null && pd.swimPace !== '' && <p><span className="text-muted-foreground">Swim pace:</span> {pd.swimPace}</p>}
                                {pd.swimDistance != null && pd.swimDistance !== '' && <p><span className="text-muted-foreground">Swim distance:</span> {pd.swimDistance}</p>}
                                {pd.bikePower != null && pd.bikePower !== '' && <p><span className="text-muted-foreground">Bike power:</span> {pd.bikePower}</p>}
                                {pd.bikeSpeed != null && pd.bikeSpeed !== '' && <p><span className="text-muted-foreground">Bike speed:</span> {pd.bikeSpeed}</p>}
                                {pd.runPace != null && pd.runPace !== '' && <p><span className="text-muted-foreground">Run pace:</span> {pd.runPace}</p>}
                                {pd.elevationGain != null && <p><span className="text-muted-foreground">Elevation:</span> {pd.elevationGain} m</p>}
                                {pd.longestSession != null && <p><span className="text-muted-foreground">Longest session:</span> {pd.longestSession} h</p>}
                                {pd.trainingFrequency != null && <p><span className="text-muted-foreground">Frequency:</span> {pd.trainingFrequency}<span>/week</span></p>}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-muted-foreground">Environment</h4>
                              <div className="space-y-1 text-sm text-foreground">
                                {pd.trainingTempRange != null && <p><span className="text-muted-foreground">Temp (training):</span> {pd.trainingTempRange.min}–{pd.trainingTempRange.max}°C</p>}
                                {pd.raceTempRange != null && <p><span className="text-muted-foreground">Temp (race):</span> {pd.raceTempRange.min}–{pd.raceTempRange.max}°C</p>}
                                {pd.humidity != null && <p><span className="text-muted-foreground">Humidity:</span> {pd.humidity}%</p>}
                                {pd.altitude != null && pd.altitude !== '' && <p><span className="text-muted-foreground">Altitude:</span> {pd.altitude}</p>}
                                {pd.altitudeMeters != null && <p><span className="text-muted-foreground">Altitude (m):</span> {pd.altitudeMeters} m</p>}
                                {pd.sunExposure != null && pd.sunExposure !== '' && <p><span className="text-muted-foreground">Sun:</span> {pd.sunExposure}</p>}
                                {pd.windConditions != null && pd.windConditions !== '' && <p><span className="text-muted-foreground">Wind:</span> {pd.windConditions}</p>}
                                {pd.clothingType != null && pd.clothingType !== '' && <p><span className="text-muted-foreground">Clothing:</span> {pd.clothingType}</p>}
                                {pd.climate != null && pd.climate !== '' && <p><span className="text-muted-foreground">Climate:</span> {pd.climate}</p>}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-muted-foreground">Hydration & sweat</h4>
                              <div className="space-y-1 text-sm text-foreground">
                                {pd.sweatRate && <p><span className="text-muted-foreground">Sweat rate:</span> {pd.sweatRate}</p>}
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

                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm text-muted-foreground">Nutrition</h4>
                              <div className="space-y-1 text-sm text-foreground">
                                {pd.dailySaltIntake != null && pd.dailySaltIntake !== '' && <p><span className="text-muted-foreground">Daily salt:</span> {pd.dailySaltIntake}</p>}
                                {pd.dailyWaterIntake != null && <p><span className="text-muted-foreground">Daily water:</span> {pd.dailyWaterIntake} L</p>}
                                {pd.caffeineIntake != null && <p><span className="text-muted-foreground">Caffeine:</span> {pd.caffeineIntake} mg</p>}
                                {pd.dietType != null && pd.dietType !== '' && <p><span className="text-muted-foreground">Diet:</span> {pd.dietType}</p>}
                                {pd.specialDiet != null && pd.specialDiet !== '' && <p><span className="text-muted-foreground">Special diet:</span> {pd.specialDiet}</p>}
                                {pd.fuelingStrategy != null && pd.fuelingStrategy !== '' && <p><span className="text-muted-foreground">Fueling:</span> {pd.fuelingStrategy}</p>}
                                {pd.caffeineStrategy != null && pd.caffeineStrategy !== '' && <p><span className="text-muted-foreground">Caffeine strategy:</span> {pd.caffeineStrategy}</p>}
                                {pd.preMealTiming != null && <p><span className="text-muted-foreground">Pre-meal timing:</span> {pd.preMealTiming} h</p>}
                                {pd.recoveryWindow != null && <p><span className="text-muted-foreground">Recovery window:</span> {pd.recoveryWindow} h</p>}
                                {pd.nutritionNotes != null && pd.nutritionNotes !== '' && <p><span className="text-muted-foreground">Nutrition notes:</span> {pd.nutritionNotes}</p>}
                                {pd.otherSupplements != null && pd.otherSupplements !== '' && <p><span className="text-muted-foreground">Supplements:</span> {pd.otherSupplements}</p>}
                              </div>
                            </div>

                            {/* Sport-Specific Data (Football) */}
                            {(pd.position || pd.matchesPerWeek || pd.playingLevel) && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-muted-foreground">Football</h4>
                                <div className="space-y-1 text-sm text-foreground">
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
                                <h4 className="font-semibold text-sm text-muted-foreground">Padel</h4>
                                <div className="space-y-1 text-sm text-foreground">
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
                              <h4 className="font-semibold text-sm text-muted-foreground">Goals & notes</h4>
                              <div className="space-y-1 text-sm text-foreground">
                                {pd.primaryGoal != null && pd.primaryGoal !== '' && <p><span className="text-muted-foreground">Primary goal:</span> {pd.primaryGoal}</p>}
                                {pd.performanceGoal != null && pd.performanceGoal !== '' && <p><span className="text-muted-foreground">Performance goal:</span> {pd.performanceGoal}</p>}
                                {pd.targetEvents != null && pd.targetEvents !== '' && <p><span className="text-muted-foreground">Target events:</span> {pd.targetEvents}</p>}
                                {pd.upcomingEvents != null && pd.upcomingEvents !== '' && <p><span className="text-muted-foreground">Upcoming events:</span> {pd.upcomingEvents}</p>}
                                {pd.pastIssues != null && pd.pastIssues !== '' && <p><span className="text-muted-foreground">Past issues:</span> {pd.pastIssues}</p>}
                                {pd.specificConcerns != null && pd.specificConcerns !== '' && <p><span className="text-muted-foreground">Concerns:</span> {pd.specificConcerns}</p>}
                                {pd.otherNotes != null && pd.otherNotes !== '' && <p><span className="text-muted-foreground">Notes:</span> {pd.otherNotes}</p>}
                              </div>
                            </div>

                            {/* Sleep & Recovery */}
                            {(pd.sleepHours != null || pd.sleepQuality != null || pd.weeklyVolume != null) && (
                              <div className="space-y-2">
                                <h4 className="font-semibold text-sm text-muted-foreground">Sleep & recovery</h4>
                                <div className="space-y-1 text-sm text-foreground">
                                  {pd.sleepHours != null && <p><span className="text-muted-foreground">Sleep:</span> {pd.sleepHours} h</p>}
                                  {pd.sleepQuality != null && <p><span className="text-muted-foreground">Sleep quality:</span> {pd.sleepQuality}<span>/10</span></p>}
                                  {pd.weeklyVolume != null && <p><span className="text-muted-foreground">Weekly volume:</span> {pd.weeklyVolume} h</p>}
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