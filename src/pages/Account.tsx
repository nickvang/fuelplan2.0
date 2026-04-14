import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AddRaceSheet } from '@/components/AddRaceSheet';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Check, X, ChevronDown, ChevronUp, CalendarPlus, ArrowRight, Trash2 } from 'lucide-react';

// ── Types ──

interface AthleteProfile {
  age: number | null;
  sex: string | null;
  weight: number | null;
  height: number | null;
  sweat_rate: string | null;
  sweat_saltiness: string | null;
  known_sodium_loss: number | null;
  resting_heart_rate: number | null;
  hrv: string | null;
  strava_connected: boolean | null;
  strava_refresh_token: string | null;
}

interface AthleteRace {
  id: string;
  race_name: string;
  race_date: string;
  distance_km: number | null;
  discipline: string | null;
  plan_id: string | null;
  status: string;
}

interface SavedPlan {
  id: string;
  profile_data: Record<string, unknown>;
  plan_data: Record<string, unknown> | null;
  created_at: string;
}

interface Calibration {
  sweat_coefficient: number;
  sodium_coefficient: number;
  sodium_loss_modifier: number;
  gi_tolerance_ceiling_ml_hr: number;
  total_feedback_count: number;
}

// ── Helpers ──

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Component ──

export default function Account() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Redirect if not logged in
  useEffect(() => {
    if (!user && !loading) navigate('/login?returnTo=/account');
  }, [user]);

  // ── Queries ──

  const { data: userProfile, isLoading: loading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, created_at')
        .eq('id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: athleteProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['athlete_profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_profiles')
        .select('age, sex, weight, height, sweat_rate, sweat_saltiness, known_sodium_loss, resting_heart_rate, hrv, strava_connected, strava_refresh_token')
        .eq('user_id', user!.id)
        .single();
      return data as AthleteProfile | null;
    },
    enabled: !!user,
  });

  const { data: upcomingRaces = [], isLoading: racesLoading } = useQuery({
    queryKey: ['upcoming_races', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('athlete_races')
        .select('id, race_name, race_date, distance_km, discipline, plan_id, status')
        .eq('user_id', user!.id)
        .eq('status', 'upcoming')
        .gte('race_date', today)
        .order('race_date', { ascending: true });
      return (data as AthleteRace[]) || [];
    },
    enabled: !!user,
  });

  const { data: pastRaces = [] } = useQuery({
    queryKey: ['past_races', user?.id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('athlete_races')
        .select('id, race_name, race_date, distance_km, discipline, plan_id, status')
        .eq('user_id', user!.id)
        .lt('race_date', today)
        .order('race_date', { ascending: false })
        .limit(10);
      return (data as AthleteRace[]) || [];
    },
    enabled: !!user,
  });

  const { data: savedPlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['saved_plans', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('hydration_profiles')
        .select('id, profile_data, plan_data, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data as SavedPlan[]) || [];
    },
    enabled: !!user,
  });

  const { data: calibration } = useQuery({
    queryKey: ['calibration', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('athlete_calibration')
        .select('sweat_coefficient, sodium_coefficient, sodium_loss_modifier, gi_tolerance_ceiling_ml_hr, total_feedback_count')
        .eq('user_id', user!.id)
        .single();
      return data as Calibration | null;
    },
    enabled: !!user,
  });

  // ── Local state ──

  const [editingProfile, setEditingProfile] = useState(false);
  const [editValues, setEditValues] = useState<Partial<AthleteProfile>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [addRaceOpen, setAddRaceOpen] = useState(false);
  const [showPastRaces, setShowPastRaces] = useState(false);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Handlers ──

  const startEditing = () => {
    setEditValues({
      age: athleteProfile?.age ?? null,
      sex: athleteProfile?.sex ?? null,
      weight: athleteProfile?.weight ?? null,
      height: athleteProfile?.height ?? null,
      sweat_rate: athleteProfile?.sweat_rate ?? null,
      sweat_saltiness: athleteProfile?.sweat_saltiness ?? null,
      known_sodium_loss: athleteProfile?.known_sodium_loss ?? null,
      resting_heart_rate: athleteProfile?.resting_heart_rate ?? null,
      hrv: athleteProfile?.hrv ?? null,
    });
    setEditingProfile(true);
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    await supabase
      .from('athlete_profiles')
      .upsert({
        user_id: user.id,
        age: editValues.age ? Number(editValues.age) : null,
        sex: editValues.sex || null,
        weight: editValues.weight ? Number(editValues.weight) : null,
        height: editValues.height ? Number(editValues.height) : null,
        sweat_rate: editValues.sweat_rate || null,
        sweat_saltiness: editValues.sweat_saltiness || null,
        known_sodium_loss: editValues.known_sodium_loss ? Number(editValues.known_sodium_loss) : null,
        resting_heart_rate: editValues.resting_heart_rate ? Number(editValues.resting_heart_rate) : null,
        hrv: editValues.hrv || null,
      }, { onConflict: 'user_id' });
    setSavingProfile(false);
    setEditingProfile(false);
    queryClient.invalidateQueries({ queryKey: ['athlete_profile', user.id] });
  };

  const handleDeleteData = async () => {
    if (!user) return;
    setDeleting(true);
    // The existing delete-user-data function requires a deletion token from hydration_profiles.
    // For account-level deletion, sign out and delete the auth user's data.
    await supabase.functions.invoke('delete-user-data', {
      body: { confirmDelete: true, deletionToken: user.id },
    });
    await signOut();
    navigate('/');
    setDeleting(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const getPlanSummary = (plan: SavedPlan) => {
    const p = plan.profile_data;
    const discipline = Array.isArray(p.disciplines) && p.disciplines.length > 0 ? p.disciplines[0] as string : '';
    const distance = (p.raceDistance as string) || '';
    const duration = p.sessionDuration ? `${p.sessionDuration}h` : '';
    return [discipline, distance, duration].filter(Boolean).join(' · ') || t('account.untitledPlan');
  };

  const getPlanStats = (plan: SavedPlan) => {
    const pd = plan.plan_data as Record<string, unknown> | null;
    if (!pd) return null;
    const during = pd.duringActivity as Record<string, unknown> | undefined;
    const totalSachets = (during?.totalElectrolytes as number || 0) +
      ((pd.preActivity as Record<string, unknown>)?.electrolytes as number || 0) +
      ((pd.postActivity as Record<string, unknown>)?.electrolytes as number || 0);
    const fluidLoss = (pd.totalFluidLoss as number) || 0;
    return { totalSachets, fluidLoss };
  };

  // ── Skeleton ──

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-white px-4 py-6">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gray-100 animate-pulse" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-48 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const fullName = userProfile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || '';
  const email = userProfile?.email || user.email || '';
  const memberSince = userProfile?.created_at || user.created_at || '';
  const avatarLetter = fullName.charAt(0).toUpperCase() || '?';
  const stravaConnected = !!(athleteProfile?.strava_connected || athleteProfile?.strava_refresh_token);

  return (
    <div className="min-h-screen bg-white px-4 py-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="max-w-lg mx-auto space-y-0">

        {/* ── Section 1: Identity ── */}
        <section className="py-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center text-2xl font-bold shrink-0">
              {avatarLetter}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-[#0a0a0a] truncate">{fullName}</h1>
              <p className="text-[13px] text-gray-400 truncate">{email}</p>
              {memberSince && (
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {t('account.memberSince', { date: formatDate(memberSince) })}
                </p>
              )}
            </div>
          </div>
        </section>

        <hr className="border-gray-100" />

        {/* ── Section 2: Body Profile ── */}
        <section className="py-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-400">
              {t('account.bodyProfile')}
            </h2>
            {!editingProfile ? (
              <button onClick={startEditing} className="p-2 text-gray-400 hover:text-[#0a0a0a] min-w-[48px] min-h-[48px] flex items-center justify-center">
                <Pencil className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => setEditingProfile(false)} className="p-2 text-gray-400 hover:text-[#0a0a0a] min-w-[48px] min-h-[48px] flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
                <button onClick={saveProfile} disabled={savingProfile} className="p-2 text-[#0a0a0a] hover:text-black min-w-[48px] min-h-[48px] flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {profileLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-gray-50 rounded animate-pulse" />
              ))}
            </div>
          ) : !editingProfile ? (
            athleteProfile ? (
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  <KV label={t('account.age')} value={athleteProfile.age} />
                  <KV label={t('account.sex')} value={athleteProfile.sex} />
                  <KV label={t('account.weight')} value={athleteProfile.weight ? `${athleteProfile.weight}kg` : null} />
                  <KV label={t('account.height')} value={athleteProfile.height ? `${athleteProfile.height}cm` : null} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <KV label={t('account.sweatRate')} value={athleteProfile.sweat_rate} />
                  <KV label={t('account.saltLevel')} value={athleteProfile.sweat_saltiness} />
                  <KV label={t('account.knownSodium')} value={athleteProfile.known_sodium_loss ? `${athleteProfile.known_sodium_loss}mg/h` : null} />
                </div>
                {(athleteProfile.resting_heart_rate || athleteProfile.hrv) && (
                  <div className="grid grid-cols-2 gap-3">
                    <KV label={t('account.restingHR')} value={athleteProfile.resting_heart_rate ? `${athleteProfile.resting_heart_rate}bpm` : null} />
                    <KV label={t('account.hrv')} value={athleteProfile.hrv} />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[13px] text-gray-400">{t('account.noProfile')}</p>
            )
          ) : (
            /* Editing mode */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <EditField label={t('account.age')} type="number" value={editValues.age ?? ''} onChange={(v) => setEditValues((p) => ({ ...p, age: v ? Number(v) : null }))} />
                <EditField label={t('account.sex')} value={editValues.sex ?? ''} onChange={(v) => setEditValues((p) => ({ ...p, sex: v || null }))} placeholder="male / female" />
                <EditField label={t('account.weight')} type="number" value={editValues.weight ?? ''} onChange={(v) => setEditValues((p) => ({ ...p, weight: v ? Number(v) : null }))} placeholder="kg" />
                <EditField label={t('account.height')} type="number" value={editValues.height ?? ''} onChange={(v) => setEditValues((p) => ({ ...p, height: v ? Number(v) : null }))} placeholder="cm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <EditField label={t('account.sweatRate')} value={editValues.sweat_rate ?? ''} onChange={(v) => setEditValues((p) => ({ ...p, sweat_rate: v || null }))} placeholder="low / medium / high" />
                <EditField label={t('account.saltLevel')} value={editValues.sweat_saltiness ?? ''} onChange={(v) => setEditValues((p) => ({ ...p, sweat_saltiness: v || null }))} placeholder="low / medium / high" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <EditField label={t('account.restingHR')} type="number" value={editValues.resting_heart_rate ?? ''} onChange={(v) => setEditValues((p) => ({ ...p, resting_heart_rate: v ? Number(v) : null }))} placeholder="bpm" />
                <EditField label={t('account.knownSodium')} type="number" value={editValues.known_sodium_loss ?? ''} onChange={(v) => setEditValues((p) => ({ ...p, known_sodium_loss: v ? Number(v) : null }))} placeholder="mg/h" />
              </div>
            </div>
          )}
        </section>

        <hr className="border-gray-100" />

        {/* ── Section 3: Connections ── */}
        <section className="py-6 space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-400">
            {t('account.connections')}
          </h2>

          {/* Strava */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border border-gray-200 rounded-lg min-h-[48px]">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z" fill={stravaConnected ? '#FC4C02' : '#ccc'} />
                <path d="M7.778 13.828h3.065L5.613 0 0 13.828h3.065l2.548-4.765 2.165 4.765z" fill={stravaConnected ? '#FC4C02' : '#ccc'} />
              </svg>
              <span className="text-[13px] font-medium text-[#0a0a0a]">Strava</span>
              {stravaConnected && (
                <span className="text-[11px] text-gray-400">{t('account.connected')}</span>
              )}
            </div>
            {stravaConnected ? (
              <Button variant="ghost" size="sm" className="text-[12px] text-gray-400 hover:text-red-500 min-h-[48px]">
                {t('account.disconnect')}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="text-[12px] min-h-[48px] border-gray-200">
                {t('account.connect')}
              </Button>
            )}
          </div>
        </section>

        <hr className="border-gray-100" />

        {/* ── Section 4: My Races ── */}
        <section className="py-6 space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-400">
            {t('account.myRaces')}
          </h2>

          {racesLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : upcomingRaces.length === 0 ? (
            <p className="text-[13px] text-gray-400">{t('account.noRaces')}</p>
          ) : (
            <div className="space-y-2">
              {upcomingRaces.map((race) => {
                const days = daysUntil(race.race_date);
                const pct = Math.max(0, Math.min(100, ((90 - days) / 90) * 100));
                return (
                  <Card key={race.id} className="p-4 border-gray-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#0a0a0a] truncate">{race.race_name}</p>
                        <p className="text-[11px] text-gray-400">{days} {days === 1 ? t('race.day') : t('race.days')}</p>
                      </div>
                      {race.plan_id ? (
                        <Button size="sm" variant="outline" className="text-[12px] min-h-[48px] border-gray-200" onClick={() => navigate('/')}>
                          {t('race.viewPlan')}
                        </Button>
                      ) : (
                        <Button size="sm" className="text-[12px] min-h-[48px] bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]" onClick={() => navigate('/')}>
                          {t('race.generatePlan')}
                        </Button>
                      )}
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-[#0a0a0a] rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Past races (collapsed) */}
          {pastRaces.length > 0 && (
            <div>
              <button
                onClick={() => setShowPastRaces(!showPastRaces)}
                className="flex items-center gap-1 text-[12px] text-gray-400 hover:text-[#0a0a0a] min-h-[48px]"
              >
                {t('account.pastRaces')} ({pastRaces.length})
                {showPastRaces ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showPastRaces && (
                <div className="space-y-1 mt-1">
                  {pastRaces.map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-3 py-2 text-[12px] text-gray-400">
                      <span className="truncate">{r.race_name}</span>
                      <span className="shrink-0">{formatDate(r.race_date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full min-h-[48px] gap-2 text-[13px] border-gray-200 text-[#0a0a0a]"
            onClick={() => setAddRaceOpen(true)}
          >
            <CalendarPlus className="w-4 h-4" />
            {t('race.addRace')}
          </Button>
        </section>

        <hr className="border-gray-100" />

        {/* ── Section 5: My Plans ── */}
        <section className="py-6 space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-400">
            {t('account.myPlans')}
          </h2>

          {plansLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-50 rounded-lg animate-pulse" />)}
            </div>
          ) : savedPlans.length === 0 ? (
            <p className="text-[13px] text-gray-400">{t('account.noPlans')}</p>
          ) : (
            <div className="space-y-2">
              {savedPlans.map((plan) => {
                const stats = getPlanStats(plan);
                const isExpanded = expandedPlan === plan.id;
                return (
                  <Card key={plan.id} className="border-gray-200 overflow-hidden">
                    <button
                      onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                      className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left min-h-[48px]"
                    >
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#0a0a0a] truncate">{getPlanSummary(plan)}</p>
                        <p className="text-[11px] text-gray-400">
                          {formatDate(plan.created_at)}
                          {stats && <> · {stats.totalSachets} sachets · {(stats.fluidLoss / 1000).toFixed(1)}L loss</>}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                    </button>
                    {isExpanded && plan.plan_data && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        <PlanDetails planData={plan.plan_data} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full min-h-[48px] gap-2 text-[13px] border-gray-200 text-[#0a0a0a]"
            onClick={() => navigate('/')}
          >
            {t('account.generateNewPlan')}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </section>

        <hr className="border-gray-100" />

        {/* ── Section 6: Personalization ── */}
        <section className="py-6 space-y-3">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-400">
            {t('account.personalization')}
          </h2>

          {calibration && calibration.total_feedback_count > 0 ? (
            <div className="space-y-2">
              <p className="text-[13px] text-[#0a0a0a]">
                {t('account.personalizedBased', { count: calibration.total_feedback_count })}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <KV
                  label={t('account.sodiumAdj')}
                  value={(() => {
                    const pct = Math.round((calibration.sodium_coefficient * calibration.sodium_loss_modifier - 1) * 100);
                    return pct === 0 ? t('account.standard') : `${pct >= 0 ? '+' : ''}${pct}%`;
                  })()}
                />
                <KV
                  label={t('account.giTolerance')}
                  value={`${calibration.gi_tolerance_ceiling_ml_hr} ml/hr`}
                />
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-gray-400">{t('account.noCalibration')}</p>
          )}
        </section>

        <hr className="border-gray-100" />

        {/* ── Section 7: Settings ── */}
        <section className="py-6 space-y-4">
          <h2 className="text-[13px] font-semibold uppercase tracking-widest text-gray-400">
            {t('account.settings')}
          </h2>

          {/* Language */}
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-[#0a0a0a]">{t('account.language')}</span>
            <LanguageSwitcher />
          </div>

          {/* Delete data */}
          <div className="space-y-2">
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 text-[13px] text-red-500 hover:text-red-700 min-h-[48px]"
              >
                <Trash2 className="w-4 h-4" />
                {t('account.deleteData')}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-[13px] text-red-500 flex-1">{t('account.deleteConfirm')}</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-[48px] border-gray-200"
                  onClick={() => setDeleteConfirm(false)}
                >
                  {t('account.cancel')}
                </Button>
                <Button
                  size="sm"
                  className="min-h-[48px] bg-red-500 text-white hover:bg-red-600"
                  disabled={deleting}
                  onClick={handleDeleteData}
                >
                  {deleting ? '...' : t('account.confirmDelete')}
                </Button>
              </div>
            )}
          </div>

          {/* Sign out */}
          <Button
            variant="outline"
            className="w-full min-h-[48px] text-[13px] border-gray-200 text-[#0a0a0a]"
            onClick={handleSignOut}
          >
            {t('auth.signOut')}
          </Button>
        </section>
      </div>

      <AddRaceSheet open={addRaceOpen} onOpenChange={setAddRaceOpen} onRaceAdded={() => queryClient.invalidateQueries({ queryKey: ['upcoming_races', user.id] })} />
    </div>
  );
}

// ── Sub-components ──

function KV({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-[13px] font-medium text-[#0a0a0a]">{value ?? '—'}</p>
    </div>
  );
}

function EditField({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-gray-400">{label}</p>
      <Input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-[48px] text-[13px]"
      />
    </div>
  );
}

function PlanDetails({ planData }: { planData: Record<string, unknown> }) {
  const pre = planData.preActivity as Record<string, unknown> | undefined;
  const during = planData.duringActivity as Record<string, unknown> | undefined;
  const post = planData.postActivity as Record<string, unknown> | undefined;

  return (
    <div className="space-y-2 text-[12px] text-gray-500">
      {pre && (
        <div>
          <span className="font-semibold text-[#0a0a0a]">Before: </span>
          {pre.water}ml + {pre.electrolytes} sachet{(pre.electrolytes as number) !== 1 ? 's' : ''}
        </div>
      )}
      {during && (
        <div>
          <span className="font-semibold text-[#0a0a0a]">During: </span>
          {during.waterPerHour}ml/hr + {during.totalElectrolytes} sachet{(during.totalElectrolytes as number) !== 1 ? 's' : ''} total
        </div>
      )}
      {post && (
        <div>
          <span className="font-semibold text-[#0a0a0a]">After: </span>
          {post.water}ml + {post.electrolytes} sachet{(post.electrolytes as number) !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
