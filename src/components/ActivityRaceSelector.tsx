import { useState, useEffect } from 'react';
import { HydrationProfile } from '@/types/hydration';
import { calculateTriathlonDuration, getTriathlonBreakdown, TRIATHLON_DISTANCES, T1_DURATION, T2_DURATION } from '@/utils/triathlonCalculator';
import { PaceDurationCalculator } from '@/components/PaceDurationCalculator';
import { RaceSelector } from '@/components/RaceSelector';
import { useRace, Race } from '@/contexts/RaceContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { InfoTooltip } from '@/components/InfoTooltip';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface StageInfo {
  day: number;
  name: string;
  distance_km: number;
  typical_duration_h: { min: number; max: number };
  queen?: boolean;
}

interface ActivityRaceSelectorProps {
  profile: Partial<HydrationProfile>;
  onUpdateProfile: (updates: Partial<HydrationProfile>) => void;
  onApplyRace: (race: Race | null) => void;
}

export function ActivityRaceSelector({ profile, onUpdateProfile, onApplyRace }: ActivityRaceSelectorProps) {
  const { t } = useLanguage();
  const { selectedRace } = useRace();

  const sports = [
    { value: 'Running', label: 'Running' },
    { value: 'Cycling', label: 'Cycling' },
    { value: 'Triathlon', label: 'Triathlon' },
  ];

  const raceSportMap: Record<string, string> = {
    Running: 'running',
    Cycling: 'cycling',
    Triathlon: 'triathlon',
  };

  const primaryDiscipline = profile.disciplines?.[0] || '';
  const isCustom = !selectedRace;

  // Stage race detection
  const isStageRace = !!(selectedRace && (selectedRace as any).is_stage_race && Array.isArray((selectedRace as any).stages));
  const stageRaceStages: StageInfo[] = isStageRace ? (selectedRace as any).stages : [];

  const [stageDurations, setStageDurations] = useState<Record<number, number>>({});

  // When a stage race is selected, pass stage metadata to profile (durations left blank for user to enter)
  useEffect(() => {
    if (!selectedRace?.id) return;
    setStageDurations({});
    if (isStageRace && stageRaceStages.length > 0) {
      // Compute sessionDuration from midpoints as a fallback for the calculator
      let maxMidpoint = 0;
      for (const stage of stageRaceStages) {
        const mid = Math.round(((stage.typical_duration_h.min + stage.typical_duration_h.max) / 2) * 10) / 10;
        if (mid > maxMidpoint) maxMidpoint = mid;
      }
      onUpdateProfile({ sessionDuration: maxMidpoint, stageDurations: undefined as any, stageRaceStages: stageRaceStages as any });
    } else {
      onUpdateProfile({ stageDurations: undefined as any, stageRaceStages: undefined as any });
    }
  }, [selectedRace?.id]);

  function formatDurationInput(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}:${String(m).padStart(2, '0')}`;
  }

  function handleStageDurationChange(day: number, value: string) {
    let hours: number;
    const hmMatch = value.match(/^(\d+):(\d{0,2})$/);
    if (hmMatch) {
      hours = parseInt(hmMatch[1]) + (parseInt(hmMatch[2] || '0') / 60);
    } else {
      hours = parseFloat(value);
    }
    if (!isFinite(hours) || hours <= 0) return;
    const updated = { ...stageDurations, [day]: hours };
    setStageDurations(updated);
    const maxDuration = Math.max(...Object.values(updated));
    onUpdateProfile({ sessionDuration: maxDuration, stageDurations: updated as any, stageRaceStages: stageRaceStages as any });
  }

  // Terrain options per sport
  const terrainOptions: Record<string, { value: string; label: string }[]> = {
    Running: [
      { value: 'road', label: 'Road' },
      { value: 'trail', label: 'Trail' },
      { value: 'treadmill', label: 'Treadmill' },
      { value: 'gravel', label: 'Gravel' },
      { value: 'track', label: 'Track' },
      { value: 'mixed', label: 'Mixed' },
    ],
    Cycling: [
      { value: 'road-bike', label: 'Road Bike' },
      { value: 'mountain-bike', label: 'Mountain Bike' },
      { value: 'gravel-bike', label: 'Gravel Bike' },
      { value: 'cyclocross', label: 'Cyclocross' },
      { value: 'mixed-cycling', label: 'Mixed' },
    ],
    Triathlon: [
      { value: 'road-triathlon', label: 'Road Triathlon' },
      { value: 'off-road-triathlon', label: 'Off-Road/XTERRA' },
      { value: 'mixed-triathlon', label: 'Mixed' },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Sport selection */}
      <div>
        <p className="text-base sm:text-lg font-bold text-foreground mb-1">
          What are you training for?
        </p>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-3">
          {sports.map((sport) => (
            <button
              key={sport.value}
              type="button"
              onClick={() => onUpdateProfile({ disciplines: [sport.value], terrain: undefined })}
              className={`
                relative flex items-center justify-center p-3 sm:p-4 rounded-xl border-2 transition-all duration-200
                ${primaryDiscipline === sport.value
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border/50 hover:border-primary/50 hover:bg-muted/30'
                }
              `}
            >
              <span className={`text-sm sm:text-base font-bold tracking-wide ${
                primaryDiscipline === sport.value ? 'text-primary' : 'text-foreground'
              }`}>
                {sport.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Race selector — on top when sport is chosen */}
      {['Running', 'Cycling', 'Triathlon'].includes(primaryDiscipline) && (
        <div className="space-y-3">
          <RaceSelector
            sport={raceSportMap[primaryDiscipline] || 'running'}
            selectedRaceId={selectedRace?.id ?? null}
            onSelectRace={onApplyRace}
          />
        </div>
      )}

      {/* Pace section */}
      {primaryDiscipline === 'Triathlon' ? (
        <div className="space-y-4">
          {/* Goal time for triathlon */}
          <div className="space-y-2">
            <Label htmlFor="ar-goalTime">Goal finish time (optional)</Label>
            <Input
              id="ar-goalTime"
              value={profile.goalTime || ''}
              onChange={(e) => onUpdateProfile({ goalTime: e.target.value })}
              placeholder="e.g., 5:30:00"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Or fill in individual paces below to calculate total time
            </p>
          </div>

          <p className="text-sm font-semibold text-foreground">Pace per discipline</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="space-y-2">
              <Label htmlFor="ar-swimPace">{t('activity.swimPace')}</Label>
              <Input
                id="ar-swimPace"
                value={profile.swimPace || ''}
                onChange={(e) => {
                  const newProfile = { ...profile, swimPace: e.target.value };
                  const duration = calculateTriathlonDuration(newProfile);
                  onUpdateProfile({ swimPace: e.target.value, ...(duration && { sessionDuration: duration }) });
                }}
                placeholder="e.g., 1:45/100m"
              />
              <p className="text-xs text-muted-foreground">Min:sec per 100m</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-bikeSpeed">{t('activity.bikeSpeed')}</Label>
              <Input
                id="ar-bikeSpeed"
                value={profile.bikeSpeed || profile.bikePower || ''}
                onChange={(e) => {
                  const newProfile = { ...profile, bikeSpeed: e.target.value };
                  const duration = calculateTriathlonDuration(newProfile);
                  onUpdateProfile({ bikeSpeed: e.target.value, ...(duration && { sessionDuration: duration }) });
                }}
                placeholder="e.g., 30 km/h"
              />
              <p className="text-xs text-muted-foreground">Average speed in km/h</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-runPace">{t('activity.runPace')}</Label>
              <Input
                id="ar-runPace"
                value={profile.runPace || ''}
                onChange={(e) => {
                  const newProfile = { ...profile, runPace: e.target.value };
                  const duration = calculateTriathlonDuration(newProfile);
                  onUpdateProfile({ runPace: e.target.value, ...(duration && { sessionDuration: duration }) });
                }}
                placeholder="e.g., 5:30/km"
              />
              <p className="text-xs text-muted-foreground">Min:sec per km</p>
            </div>
          </div>

          {/* Triathlon breakdown preview */}
          {(() => {
            const breakdown = getTriathlonBreakdown(profile);
            if (!breakdown) return null;
            const fmtDuration = (h: number) => {
              const hrs = Math.floor(h);
              const rm = (h - hrs) * 60;
              const mins = Math.floor(rm);
              const secs = Math.round((rm - mins) * 60);
              return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            };
            return (
              <div className="space-y-3 py-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Total Estimated Time</p>
                  <p className="text-2xl sm:text-3xl md:text-4xl font-black text-primary">{fmtDuration(breakdown.total)}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-700">Swim {Math.round(breakdown.swim.duration * 60)}min</span>
                  <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">T1 {Math.round(breakdown.t1.duration * 60)}min</span>
                  <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-700">Bike {Math.round(breakdown.bike.duration * 60)}min</span>
                  <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">T2 {Math.round(breakdown.t2.duration * 60)}min</span>
                  <span className="px-2 py-1 rounded-full bg-orange-500/10 text-orange-700">Run {Math.round(breakdown.run.duration * 60)}min</span>
                </div>
              </div>
            );
          })()}
        </div>
      ) : primaryDiscipline ? (
        isStageRace ? (
          <div className="space-y-3 p-4 rounded-xl border border-border/60 bg-card animate-in fade-in duration-200">
            <div>
              <p className="text-sm font-semibold text-foreground">How long do you expect each stage to take?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Enter your expected finish time for each stage</p>
            </div>
            <div className="space-y-2">
              {stageRaceStages.map((stage) => (
                <div
                  key={stage.day}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border ${
                    stage.queen
                      ? 'border-amber-400/60 bg-amber-50/50 dark:bg-amber-900/10'
                      : 'border-border/40 bg-muted/20'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{stage.name}</span>
                      {stage.queen && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 shrink-0">Queen</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {stage.distance_km}km · {stage.typical_duration_h.min}–{stage.typical_duration_h.max}h typical
                    </p>
                  </div>
                  <Input
                    value={stageDurations[stage.day] != null ? formatDurationInput(stageDurations[stage.day]) : ''}
                    onChange={(e) => handleStageDurationChange(stage.day, e.target.value)}
                    placeholder="h:mm"
                    className={`w-20 text-center font-mono text-sm ${
                      stage.queen ? 'border-amber-400/60' : ''
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <PaceDurationCalculator
            discipline={primaryDiscipline}
            raceDistance={profile.raceDistance}
            goalTime={profile.goalTime || undefined}
            currentPace={profile.avgPace}
            onPaceChange={(pace) => onUpdateProfile({ avgPace: pace })}
            onDurationChange={(duration) => onUpdateProfile({ sessionDuration: duration })}
            onGoalTimeChange={(goalTime) => onUpdateProfile({ goalTime })}
          />
        )
      ) : null}

      {/* Custom training fields — only when no race selected */}
      {primaryDiscipline && isCustom && (
        <div className="space-y-4 p-4 rounded-xl border border-border/60 bg-card animate-in fade-in duration-200">
          <p className="text-sm font-semibold text-foreground">Training details</p>

          {/* Distance */}
          <div className="space-y-2">
            <Label htmlFor="ar-distance">
              {primaryDiscipline === 'Triathlon' ? 'Race type or distance (km) *' : 'Distance (km) *'}
            </Label>
            <Input
              id="ar-distance"
              value={profile.raceDistance || ''}
              onChange={(e) => onUpdateProfile({ raceDistance: e.target.value })}
              placeholder={
                primaryDiscipline === 'Running' ? 'e.g., 10km, Half Marathon, Marathon' :
                primaryDiscipline === 'Cycling' ? 'e.g., 40km, 100km, 160km' :
                primaryDiscipline === 'Triathlon' ? 'e.g., Sprint, 70.3, Ironman' : 'e.g., 10km'
              }
            />
          </div>

          {/* Terrain */}
          {terrainOptions[primaryDiscipline] && (
            <div>
              <Label className="text-sm font-semibold">
                {primaryDiscipline === 'Running' ? 'Terrain *' :
                  primaryDiscipline === 'Cycling' ? 'Type *' :
                    'Terrain *'}
              </Label>
              <RadioGroup
                value={profile.terrain || ''}
                onValueChange={(value) => onUpdateProfile({ terrain: value })}
                className="mt-2 flex flex-wrap gap-2"
              >
                {terrainOptions[primaryDiscipline].map((opt) => (
                  <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                    profile.terrain === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border/50 hover:border-primary/50'
                  }`}>
                    <RadioGroupItem value={opt.value} id={`terrain-${opt.value}`} className="sr-only" />
                    <span className="text-sm font-medium">{opt.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Conditions */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ar-altitude">Altitude (m)</Label>
              <Input
                id="ar-altitude"
                type="number"
                value={profile.altitudeMeters || ''}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = v === '' ? undefined : Number(v);
                  let altitude: HydrationProfile['altitude'] = 'sea-level';
                  if (typeof n === 'number' && !Number.isNaN(n)) {
                    if (n > 2500) altitude = 'high';
                    else if (n > 1000) altitude = 'moderate';
                  }
                  onUpdateProfile({ altitudeMeters: n as any, altitude });
                }}
                placeholder="e.g., 5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ar-temp">Temperature (°C)</Label>
              <Input
                id="ar-temp"
                type="number"
                value={
                  profile.raceTempRange && profile.raceTempRange.min === profile.raceTempRange.max
                    ? profile.raceTempRange.min
                    : ''
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    onUpdateProfile({ raceTempRange: undefined } as Partial<HydrationProfile>);
                    return;
                  }
                  const n = Number(v);
                  if (!Number.isNaN(n)) {
                    onUpdateProfile({
                      raceTempRange: { min: n, max: n },
                      trainingTempRange: profile.trainingTempRange ?? { min: n, max: n },
                    } as Partial<HydrationProfile>);
                  }
                }}
                placeholder="e.g., 18"
              />
            </div>
          </div>

          {/* Humidity */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Label htmlFor="ar-humidity">{t('env.humidity')} *</Label>
              <InfoTooltip content={t('env.humidityTooltip')} />
            </div>
            <Input
              id="ar-humidity"
              type="number"
              value={profile.humidity || ''}
              onChange={(e) => onUpdateProfile({ humidity: parseInt(e.target.value) })}
              placeholder={t('env.humidityPlaceholder')}
            />
          </div>

          {/* Altitude radio */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Label>{t('env.altitude')} *</Label>
              <InfoTooltip content={t('env.altitudeTooltipPro')} />
            </div>
            <RadioGroup
              value={profile.altitude || ''}
              onValueChange={(value) => onUpdateProfile({ altitude: value as 'sea-level' | 'moderate' | 'high' })}
              className="flex flex-wrap gap-x-4 gap-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="sea-level" id="ar-sea-level" />
                <Label htmlFor="ar-sea-level" className="font-normal">{t('env.seaLevel')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="moderate" id="ar-moderate" />
                <Label htmlFor="ar-moderate" className="font-normal">{t('env.moderateAltitude')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="ar-high" />
                <Label htmlFor="ar-high" className="font-normal">{t('env.highAltitude')}</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Sun / Wind / Clothing — compact row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">{t('env.sunExposure')} *</Label>
              <RadioGroup
                value={profile.sunExposure || ''}
                onValueChange={(value) => onUpdateProfile({ sunExposure: value as 'shade' | 'partial' | 'full-sun' })}
                className="mt-1 space-y-1"
              >
                {[
                  { value: 'shade', label: t('env.shade') },
                  { value: 'partial', label: t('env.partial') },
                  { value: 'full-sun', label: t('env.fullSun') },
                ].map((o) => (
                  <div key={o.value} className="flex items-center space-x-1.5">
                    <RadioGroupItem value={o.value} id={`ar-sun-${o.value}`} />
                    <Label htmlFor={`ar-sun-${o.value}`} className="font-normal text-xs">{o.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label className="text-xs">{t('env.wind')} *</Label>
              <RadioGroup
                value={profile.windConditions || ''}
                onValueChange={(value) => onUpdateProfile({ windConditions: value as 'calm' | 'moderate' | 'windy' })}
                className="mt-1 space-y-1"
              >
                {[
                  { value: 'calm', label: t('env.calm') },
                  { value: 'moderate', label: t('env.moderateWind') },
                  { value: 'windy', label: t('env.windy') },
                ].map((o) => (
                  <div key={o.value} className="flex items-center space-x-1.5">
                    <RadioGroupItem value={o.value} id={`ar-wind-${o.value}`} />
                    <Label htmlFor={`ar-wind-${o.value}`} className="font-normal text-xs">{o.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label className="text-xs">{t('env.clothing')} *</Label>
              <RadioGroup
                value={profile.clothingType || ''}
                onValueChange={(value) => onUpdateProfile({ clothingType: value as 'minimal' | 'light' | 'moderate' | 'heavy' })}
                className="mt-1 space-y-1"
              >
                {[
                  { value: 'minimal', label: t('env.minimal') },
                  { value: 'light', label: t('env.light') },
                  { value: 'moderate', label: t('env.moderateClothing') },
                  { value: 'heavy', label: t('env.heavy') },
                ].map((o) => (
                  <div key={o.value} className="flex items-center space-x-1.5">
                    <RadioGroupItem value={o.value} id={`ar-cloth-${o.value}`} />
                    <Label htmlFor={`ar-cloth-${o.value}`} className="font-normal text-xs">{o.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
