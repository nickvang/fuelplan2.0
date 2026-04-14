import { useState, useEffect, useCallback } from 'react';
import { HydrationProfile } from '@/types/hydration';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AddRaceSheet } from '@/components/AddRaceSheet';
import { RaceFeedback } from '@/components/RaceFeedback';
import supplmeLogo from '@/assets/supplme-logo-sort.svg';
import { ArrowRight, Plus, RotateCcw, CalendarPlus, Zap, MessageCircle } from 'lucide-react';

interface SavedPlan {
  id: string;
  profile_data: Record<string, unknown>;
  plan_data: Record<string, unknown>;
  created_at: string;
}

interface AthleteRace {
  id: string;
  race_name: string;
  race_date: string;
  distance_km: number | null;
  discipline: string | null;
  location_city: string | null;
  plan_id: string | null;
  status: string;
}

interface LoggedInHomeProps {
  onStartQuestionnaire: () => void;
  onRedoPlan: (profileData: Partial<HydrationProfile>) => void;
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const race = new Date(dateStr + 'T00:00:00');
  return Math.ceil((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function LoggedInHome({ onStartQuestionnaire, onRedoPlan }: LoggedInHomeProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [races, setRaces] = useState<AthleteRace[]>([]);
  const [pastRacesNeedingFeedback, setPastRacesNeedingFeedback] = useState<AthleteRace[]>([]);
  const [loading, setLoading] = useState(true);
  const [addRaceOpen, setAddRaceOpen] = useState(false);
  const [feedbackRace, setFeedbackRace] = useState<AthleteRace | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const [plansRes, racesRes, pastRacesRes, feedbackRes] = await Promise.all([
      supabase
        .from('hydration_profiles')
        .select('id, profile_data, plan_data, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('athlete_races')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'upcoming')
        .gte('race_date', today)
        .order('race_date', { ascending: true }),
      supabase
        .from('athlete_races')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'upcoming')
        .lt('race_date', today)
        .order('race_date', { ascending: false })
        .limit(5),
      supabase
        .from('race_feedback')
        .select('race_id')
        .eq('user_id', user.id),
    ]);
    setSavedPlans((plansRes.data as SavedPlan[]) || []);
    setRaces((racesRes.data as AthleteRace[]) || []);

    // Filter past races that don't have feedback yet
    const feedbackRaceIds = new Set((feedbackRes.data || []).map((f: { race_id: string }) => f.race_id));
    const needFeedback = ((pastRacesRes.data as AthleteRace[]) || []).filter(
      (r) => !feedbackRaceIds.has(r.id)
    );
    setPastRacesNeedingFeedback(needFeedback);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatRaceDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getPlanSummary = (plan: SavedPlan) => {
    const p = plan.profile_data as Record<string, unknown>;
    const discipline = Array.isArray(p.disciplines) && p.disciplines.length > 0
      ? p.disciplines[0] as string
      : '';
    const distance = (p.raceDistance as string) || '';
    const duration = p.sessionDuration ? `${p.sessionDuration}h` : '';
    return [discipline, distance, duration].filter(Boolean).join(' · ') || t('home.untitledPlan');
  };

  const handleRedo = (plan: SavedPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    onRedoPlan(plan.profile_data as unknown as Partial<HydrationProfile>);
  };

  // Upcoming races within 90 days
  const upcomingRaces = races.filter((r) => {
    const days = daysUntil(r.race_date);
    return days >= 0 && days <= 90;
  });

  // Skeleton shimmer loading
  if (loading) {
    return (
      <div className="min-h-screen min-w-0 bg-white relative overflow-x-hidden pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-12 px-3 sm:px-4 md:px-6">
        <div className="max-w-2xl mx-auto min-w-0 space-y-6">
          <div className="flex justify-between items-center">
            <div className="h-10 w-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="border border-gray-200 rounded-lg p-5 space-y-3">
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
            <div className="h-2 w-full bg-gray-100 rounded-full animate-pulse" />
          </div>
          <div className="border border-gray-200 rounded-lg p-6 space-y-3">
            <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-12 w-full bg-gray-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  const headerBar = (
    <div className="flex justify-end items-center">
      <LanguageSwitcher />
    </div>
  );

  // No plans AND no races — first plan CTA
  if (savedPlans.length === 0 && races.length === 0) {
    return (
      <div className="min-h-screen min-w-0 bg-white relative overflow-x-hidden pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-12 px-3 sm:px-4 md:px-6">
        <div className="max-w-2xl mx-auto min-w-0">
          <div className="flex justify-end items-center mb-2">
            <LanguageSwitcher />
          </div>

          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
            <img src={supplmeLogo} alt="Supplme" className="h-20 sm:h-24 md:h-32 mx-auto max-w-full w-auto" />
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-black">
                {t('home.firstPlanTitle')}
              </h1>
              <p className="text-gray-500 text-base sm:text-lg max-w-md mx-auto">
                {t('home.firstPlanSubtitle')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
              <Button
                size="lg"
                className="flex-1 text-base min-h-[48px] gap-2 bg-black text-white hover:bg-gray-800"
                onClick={onStartQuestionnaire}
              >
                {t('home.createFirstPlan')}
                <ArrowRight className="w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 text-base min-h-[48px] gap-2 border-gray-200 text-black hover:bg-gray-50"
                onClick={() => setAddRaceOpen(true)}
              >
                <CalendarPlus className="w-5 h-5" />
                {t('race.addRace')}
              </Button>
            </div>
          </div>
        </div>
        <AddRaceSheet open={addRaceOpen} onOpenChange={setAddRaceOpen} onRaceAdded={fetchData} />
      </div>
    );
  }

  // Main home view
  const latestPlan = savedPlans[0];

  return (
    <div className="min-h-screen min-w-0 bg-white relative overflow-x-hidden pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-12 px-3 sm:px-4 md:px-6">
      <div className="max-w-2xl mx-auto min-w-0 space-y-5">
        {headerBar}

        {/* Post-race feedback banners */}
        {pastRacesNeedingFeedback.map((race) => (
          <button
            key={race.id}
            onClick={() => setFeedbackRace(race)}
            className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors text-left min-h-[48px]"
          >
            <MessageCircle className="w-4 h-4 text-gray-400 shrink-0" />
            <p className="text-[13px] text-[#0a0a0a] flex-1 min-w-0">
              <span className="font-semibold">{race.race_name}</span>
              <span className="text-gray-400"> · {t('feedback.howDidItGo')} </span>
              <ArrowRight className="w-3.5 h-3.5 inline text-gray-400" />
            </p>
          </button>
        ))}

        {/* Race countdown cards */}
        {upcomingRaces.map((race) => {
          const days = daysUntil(race.race_date);
          const progressPct = Math.max(0, Math.min(100, ((90 - days) / 90) * 100));
          const hasPlan = !!race.plan_id;

          return (
            <Card key={race.id} className="p-5 border-gray-200 bg-white">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-[#0a0a0a] truncate">{race.race_name}</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">
                      {formatRaceDate(race.race_date)}
                      {race.location_city && ` · ${race.location_city}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-black text-[#0a0a0a] tabular-nums">{days}</p>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                      {days === 1 ? t('race.day') : t('race.days')}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#0a0a0a] rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* CTA */}
                {hasPlan ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 min-h-[44px] bg-[#0a0a0a] text-white hover:bg-[#1a1a1a] text-[13px]"
                      onClick={() => {
                        // Find the plan and redo it
                        const linked = savedPlans.find((p) => p.id === race.plan_id);
                        if (linked) onRedoPlan(linked.profile_data as unknown as Partial<HydrationProfile>);
                      }}
                    >
                      {t('race.viewPlan')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px] border-gray-200 text-[#0a0a0a] text-[13px]"
                      onClick={onStartQuestionnaire}
                    >
                      {t('race.updatePlan')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    className="w-full min-h-[44px] gap-1.5 bg-[#0a0a0a] text-white hover:bg-[#1a1a1a] text-[13px]"
                    onClick={onStartQuestionnaire}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {t('race.generatePlan')}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}

        {/* Latest plan — hero card */}
        {latestPlan && (
          <Card
            className="p-5 border-gray-200 bg-white cursor-pointer hover:border-black/30 transition-colors group"
            onClick={(e) => handleRedo(latestPlan, e)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                  {t('home.latestPlan')}
                </p>
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-black truncate">
                  {getPlanSummary(latestPlan)}
                </h2>
                <p className="text-[12px] text-gray-400">
                  {formatDate(latestPlan.created_at)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 min-h-[48px] min-w-[48px] border-gray-200 text-black hover:bg-gray-50"
                onClick={(e) => handleRedo(latestPlan, e)}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">{t('home.redo')}</span>
              </Button>
            </div>
          </Card>
        )}

        {/* Action buttons row */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 min-h-[48px] gap-2 text-base border-gray-200 text-black hover:bg-gray-50"
            onClick={onStartQuestionnaire}
          >
            <Plus className="w-5 h-5" />
            {t('home.newPlan')}
          </Button>
          <Button
            variant="outline"
            className="flex-1 min-h-[48px] gap-2 text-base border-gray-200 text-black hover:bg-gray-50"
            onClick={() => setAddRaceOpen(true)}
          >
            <CalendarPlus className="w-5 h-5" />
            {t('race.addRace')}
          </Button>
        </div>

        {/* Previous plans */}
        {savedPlans.length > 1 && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              {t('home.previousPlans')}
            </h3>
            <div className="space-y-2">
              {savedPlans.slice(1).map((plan) => (
                <Card
                  key={plan.id}
                  className="p-4 border-gray-200 bg-white hover:border-black/20 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-black truncate">{getPlanSummary(plan)}</p>
                      <p className="text-xs text-gray-400">{formatDate(plan.created_at)}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 min-h-[48px] min-w-[48px] text-gray-400 hover:text-black hover:bg-gray-50"
                      onClick={(e) => handleRedo(plan, e)}
                    >
                      <RotateCcw className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <AddRaceSheet open={addRaceOpen} onOpenChange={setAddRaceOpen} onRaceAdded={fetchData} />

      {feedbackRace && (
        <RaceFeedback
          raceId={feedbackRace.id}
          raceName={feedbackRace.race_name}
          planId={feedbackRace.plan_id}
          onClose={() => setFeedbackRace(null)}
          onSubmitted={fetchData}
        />
      )}
    </div>
  );
}
