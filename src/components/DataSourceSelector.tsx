import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { InfoTooltip } from '@/components/InfoTooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { HydrationProfile } from '@/types/hydration';

export type DataSource = 'strava' | 'garmin' | 'manual';

interface DataSourceSelectorProps {
  selectedSource: DataSource | null;
  onSelectSource: (source: DataSource) => void;
  consentGiven: boolean;
  onConsentChange: (consent: boolean) => void;
  stravaConnected: boolean;
  garminConnected: boolean;
  onStravaConnect: () => void;
  onGarminConnect: () => void;
  hasStravaConfig: boolean;
  hasGarminConfig: boolean;
  smartwatchFiles: File[];
  onSmartWatchFilesChange: (files: File[]) => void;
  /** Manual mode: body profile fields */
  profile: Partial<HydrationProfile>;
  onUpdateProfile: (updates: Partial<HydrationProfile>) => void;
}

/* Strava wordmark SVG */
const StravaLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zM7.298 10.172h3.066L12 5.492l1.636 4.68h3.066L12 0z" />
  </svg>
);

/* Garmin "G" delta logo */
const GarminLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9h4v2h-2v2h-2z" />
  </svg>
);

export function DataSourceSelector({
  selectedSource,
  onSelectSource,
  consentGiven,
  onConsentChange,
  stravaConnected,
  garminConnected,
  onStravaConnect,
  onGarminConnect,
  hasStravaConfig,
  hasGarminConfig,
  smartwatchFiles,
  onSmartWatchFilesChange,
  profile,
  onUpdateProfile,
}: DataSourceSelectorProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Connect your platform */}
      <div className="text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          Connect your training platform to auto-fill from your data
        </p>
      </div>

      {/* Strava + Garmin side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Strava */}
        <button
          type="button"
          disabled={!hasStravaConfig}
          onClick={() => {
            onSelectSource('strava');
          }}
          className={`
            relative flex flex-col items-center gap-3 p-6 sm:p-8 rounded-xl border-2 transition-all duration-200
            ${selectedSource === 'strava'
              ? 'border-[#FC4C02] bg-[#FC4C02]/5 shadow-md shadow-[#FC4C02]/10'
              : selectedSource === 'garmin'
                ? 'border-border/30 bg-muted/10 opacity-40'
                : 'border-border/50 hover:border-[#FC4C02]/40 hover:bg-[#FC4C02]/[0.02]'
            }
            ${!hasStravaConfig ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="w-12 h-12 rounded-xl bg-[#FC4C02] flex items-center justify-center text-white shadow-sm">
            <StravaLogo className="w-6 h-6" />
          </div>
          <span className={`text-sm sm:text-base font-bold tracking-wide ${selectedSource === 'strava' ? 'text-[#FC4C02]' : 'text-foreground'}`}>
            Strava
          </span>
          {stravaConnected ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#FC4C02]">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.22a.75.75 0 0 0-1.06 0L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06Z" /></svg>
              Connected
            </span>
          ) : selectedSource === 'strava' ? (
            <span className="text-xs font-medium text-[#FC4C02] animate-pulse">Connecting...</span>
          ) : null}
        </button>

        {/* Garmin */}
        <button
          type="button"
          disabled={!hasGarminConfig}
          onClick={() => {
            onSelectSource('garmin');
          }}
          className={`
            relative flex flex-col items-center gap-3 p-6 sm:p-8 rounded-xl border-2 transition-all duration-200
            ${selectedSource === 'garmin'
              ? 'border-[#007CC3] bg-[#007CC3]/5 shadow-md shadow-[#007CC3]/10'
              : selectedSource === 'strava'
                ? 'border-border/30 bg-muted/10 opacity-40'
                : 'border-border/50 hover:border-[#007CC3]/40 hover:bg-[#007CC3]/[0.02]'
            }
            ${!hasGarminConfig ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <div className="w-12 h-12 rounded-xl bg-[#007CC3] flex items-center justify-center text-white shadow-sm">
            <GarminLogo className="w-6 h-6" />
          </div>
          <span className={`text-sm sm:text-base font-bold tracking-wide ${selectedSource === 'garmin' ? 'text-[#007CC3]' : 'text-foreground'}`}>
            Garmin
          </span>
          {garminConnected ? (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-[#007CC3]">
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.22a.75.75 0 0 0-1.06 0L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06Z" /></svg>
              Connected
            </span>
          ) : selectedSource === 'garmin' ? (
            <span className="text-xs font-medium text-[#007CC3] animate-pulse">Connecting...</span>
          ) : null}
        </button>
      </div>

      {/* Divider + Manual option */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-border/50" />
        <button
          type="button"
          onClick={() => onSelectSource('manual')}
          className={`
            text-sm font-medium transition-colors duration-200 px-1
            ${selectedSource === 'manual'
              ? 'text-foreground underline underline-offset-4'
              : 'text-muted-foreground hover:text-foreground'
            }
          `}
        >
          or enter details manually
        </button>
        <div className="flex-1 h-px bg-border/50" />
      </div>

      {/* Manual body input fields */}
      {selectedSource === 'manual' && (
        <div className="space-y-4 p-4 rounded-xl border border-border/60 bg-card animate-in fade-in duration-200">
          <p className="text-sm font-semibold text-foreground">Your Details</p>

          <div>
            <Label htmlFor="ds-fullName">{t('body.fullNameOptional')}</Label>
            <Input
              id="ds-fullName"
              type="text"
              value={profile.fullName || ''}
              onChange={(e) => onUpdateProfile({ fullName: e.target.value })}
              placeholder={t('body.fullNamePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="ds-age">{t('body.age')} *</Label>
              <Input
                id="ds-age"
                type="number"
                value={profile.age || ''}
                onChange={(e) => onUpdateProfile({ age: parseInt(e.target.value) })}
                placeholder="e.g., 32"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label htmlFor="ds-weight">{t('body.weight')} *</Label>
                <InfoTooltip content={t('body.tooltip.weight')} />
              </div>
              <Input
                id="ds-weight"
                type="number"
                value={profile.weight || ''}
                onChange={(e) => onUpdateProfile({ weight: parseInt(e.target.value) })}
                placeholder="e.g., 72"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ds-height">{t('body.height')} *</Label>
            <Input
              id="ds-height"
              type="number"
              value={profile.height || ''}
              onChange={(e) => onUpdateProfile({ height: parseInt(e.target.value) })}
              placeholder="e.g., 178"
            />
          </div>

          <div className="space-y-1">
            <Label>{t('body.sex')} *</Label>
            <RadioGroup
              value={profile.sex || ''}
              onValueChange={(value) => onUpdateProfile({ sex: value as 'male' | 'female' | 'other' })}
              className="flex flex-wrap gap-x-4 gap-y-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="ds-male" />
                <Label htmlFor="ds-male" className="font-normal">{t('body.male')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="ds-female" />
                <Label htmlFor="ds-female" className="font-normal">{t('body.female')}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="ds-other" />
                <Label htmlFor="ds-other" className="font-normal">{t('body.other')}</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Advanced metrics — collapsible */}
          <Accordion type="single" collapsible>
            <AccordionItem value="advanced" className="border-none">
              <AccordionTrigger className="text-xs sm:text-sm font-semibold py-2 min-h-[44px] hover:no-underline text-left">
                Advanced body metrics (optional)
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="ds-bodyFat">{t('body.bodyFat')}</Label>
                      <InfoTooltip content="Body fat % affects hydration — lower body fat = more body water. Typical athletic range: 6-24% (men), 14-31% (women)." />
                    </div>
                    <Input
                      id="ds-bodyFat"
                      type="number"
                      value={profile.bodyFat || ''}
                      onChange={(e) => onUpdateProfile({ bodyFat: parseFloat(e.target.value) })}
                      placeholder={t('common.optional')}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="ds-rhr">{t('body.restingHR')}</Label>
                      <InfoTooltip content="Resting heart rate indicates fitness level. Find it on your watch's morning report. Typical athletic range: 40-60 bpm." />
                    </div>
                    <Input
                      id="ds-rhr"
                      type="number"
                      value={profile.restingHeartRate || ''}
                      onChange={(e) => onUpdateProfile({ restingHeartRate: parseInt(e.target.value) })}
                      placeholder={t('common.bpm')}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="ds-hrv">{t('body.hrv')}</Label>
                    <InfoTooltip content="Heart Rate Variability measures recovery status. Low HRV = poor recovery, may need extra hydration." />
                  </div>
                  <Input
                    id="ds-hrv"
                    value={profile.hrv || ''}
                    onChange={(e) => onUpdateProfile({ hrv: e.target.value })}
                    placeholder={t('common.garminWhoop')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="ds-sleep">{t('body.avgSleep')}</Label>
                    <Input
                      id="ds-sleep"
                      type="number"
                      step="0.5"
                      value={profile.sleepHours || ''}
                      onChange={(e) => onUpdateProfile({ sleepHours: parseFloat(e.target.value) })}
                      placeholder={t('common.hoursPerNight')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ds-sleepq">{t('body.sleepQuality')}</Label>
                    <Input
                      id="ds-sleepq"
                      type="number"
                      min="1"
                      max="10"
                      value={profile.sleepQuality || ''}
                      onChange={(e) => onUpdateProfile({ sleepQuality: parseInt(e.target.value) })}
                      placeholder={t('common.oneToTen')}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="space-y-1">
            <Label htmlFor="ds-health">{t('body.healthConditions')}</Label>
            <Input
              id="ds-health"
              value={profile.healthConditions || ''}
              onChange={(e) => onUpdateProfile({ healthConditions: e.target.value })}
              placeholder={t('common.healthExample')}
            />
          </div>
        </div>
      )}

      {/* Smartwatch file upload — manual mode */}
      {selectedSource === 'manual' && (
        <div className="bg-muted/40 p-3 rounded-xl space-y-2">
          <p className="text-xs font-medium text-foreground">
            {t('upload.title')} <span className="text-muted-foreground">({t('common.optional')})</span>
          </p>
          <p className="text-xs text-muted-foreground">{t('upload.description')}</p>
          <input
            id="ds-smartwatch-files"
            type="file"
            multiple
            accept=".fit,.csv,.json,.xml,.txt"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) onSmartWatchFilesChange([...smartwatchFiles, ...files]);
              e.target.value = '';
            }}
            className="sr-only"
          />
          <label
            htmlFor="ds-smartwatch-files"
            className="flex items-center justify-between gap-4 min-h-[44px] px-4 py-2 rounded-lg border border-border/50 bg-background cursor-pointer hover:border-border transition-colors text-sm"
          >
            <span className="font-medium text-foreground">{t('smartwatch.chooseFiles')}</span>
            <span className="text-muted-foreground truncate">
              {smartwatchFiles.length > 0
                ? t('smartwatch.filesChosen').replace('{count}', smartwatchFiles.length.toString())
                : t('smartwatch.noFileChosen')}
            </span>
          </label>
          {smartwatchFiles.length > 0 && (
            <p className="text-xs text-green-600 font-medium flex items-center gap-2">
              {t('smartwatch.uploaded').replace('{count}', smartwatchFiles.length.toString())}
              <button
                type="button"
                onClick={() => onSmartWatchFilesChange([])}
                className="py-1 px-3 text-muted-foreground hover:text-foreground rounded border border-border/50"
              >
                {t('smartwatch.remove')}
              </button>
            </p>
          )}
        </div>
      )}

      {/* Consent nudge — show when source is ready but consent not given */}
      {selectedSource && !consentGiven && (
        (selectedSource === 'strava' && stravaConnected) ||
        (selectedSource === 'garmin' && garminConnected) ||
        selectedSource === 'manual'
      ) && (
        <p className="text-sm font-medium text-center text-foreground animate-in fade-in duration-300">
          Accept the terms below to continue
        </p>
      )}

      {/* GDPR consent */}
      <div className={`bg-muted/40 p-3 rounded-xl space-y-2 transition-all duration-300 ${
        selectedSource && !consentGiven ? 'ring-2 ring-primary/30' : ''
      }`}>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="gdpr" className="border-none">
            <AccordionTrigger className="text-xs sm:text-sm font-semibold py-2 min-h-[44px] hover:no-underline text-left touch-manipulation">
              {t('gdpr.short')} – {t('gdpr.compliance.title')}
            </AccordionTrigger>
            <AccordionContent className="text-xs text-muted-foreground space-y-2 pt-1">
              <p>{t('gdpr.ai.description')}</p>
              <p>{t('gdpr.compliance.intro')}</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>{t('gdpr.dataCollection.text')}</li>
                <li>{t('gdpr.storage.text')}</li>
                <li>{t('gdpr.rights.text')}</li>
              </ul>
              <p className="pt-1">{t('gdpr.contact')}</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex items-center gap-3 pt-2 border-t border-border/50 min-h-[44px]">
          <Checkbox
            id="ds-consent"
            checked={consentGiven}
            onCheckedChange={(checked) => onConsentChange(checked === true)}
            className="shrink-0 h-5 w-5"
          />
          <label htmlFor="ds-consent" className="text-xs sm:text-sm font-medium cursor-pointer leading-snug py-2 flex-1 select-none">
            {t('consent.short')}
          </label>
        </div>
      </div>
    </div>
  );
}
