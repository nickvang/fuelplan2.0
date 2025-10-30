import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Download, LogOut, Trash2, Users, Database, Activity, ChevronDown, ChevronRight } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import supplmeLogo from '@/assets/supplme-logo.png';

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
  });
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
      
      // Calculate stats
      const total = data?.length || 0;
      const withSmartwatch = data?.filter((p: any) => p.has_smartwatch_data).length || 0;
      
      setStats({
        total,
        withSmartwatch,
        withoutSmartwatch: total - withSmartwatch,
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
        'ID', 'Created At', 'Email', 'Consent', 'Smartwatch Data',
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
            <img src={supplmeLogo} alt="Supplme" className="h-16" />
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Users className="w-10 h-10 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Profiles</p>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Activity className="w-10 h-10 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">With Smartwatch</p>
                <p className="text-3xl font-bold">{stats.withSmartwatch}</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Database className="w-10 h-10 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Manual Entry</p>
                <p className="text-3xl font-bold">{stats.withoutSmartwatch}</p>
              </div>
            </div>
          </Card>
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
                            
                            {/* Hydration Plan */}
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm">Hydration Plan</h4>
                              <div className="space-y-1 text-sm">
                                {plan.totalFluidLoss && <p><span className="text-muted-foreground">Total Loss:</span> {(plan.totalFluidLoss / 1000).toFixed(1)}L</p>}
                                {plan.preActivity?.water && <p><span className="text-muted-foreground">Pre-Water:</span> {plan.preActivity.water}ml</p>}
                                {plan.preActivity?.electrolytes && <p><span className="text-muted-foreground">Pre-Electrolytes:</span> {plan.preActivity.electrolytes}</p>}
                                {plan.duringActivity?.waterPerHour && <p><span className="text-muted-foreground">During-Water:</span> {plan.duringActivity.waterPerHour}ml/hr</p>}
                                {plan.duringActivity?.electrolytesPerHour && <p><span className="text-muted-foreground">During-Electrolytes:</span> {plan.duringActivity.electrolytesPerHour}/hr</p>}
                                {plan.postActivity?.water && <p><span className="text-muted-foreground">Post-Water:</span> {plan.postActivity.water}ml</p>}
                                {plan.postActivity?.electrolytes && <p><span className="text-muted-foreground">Post-Electrolytes:</span> {plan.postActivity.electrolytes}</p>}
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