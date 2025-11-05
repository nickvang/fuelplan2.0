import { useState } from 'react';
import { HydrationProfile } from '@/types/hydration';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { validateAndSanitizeProfile } from '@/utils/profileValidation';
import { parseSmartWatchFiles } from '@/utils/garminDataParser';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import { HydrationPlanDisplay } from '@/components/HydrationPlanDisplay';
import { InfoTooltip } from '@/components/InfoTooltip';
import { ValidationWarning, getValidationWarnings } from '@/components/ValidationWarning';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import supplmeLogo from '@/assets/supplme-logo.png';

const Index = () => {
  const { t } = useLanguage();
  const [version, setVersion] = useState<'simple' | 'pro' | null>('simple'); // Version selection - Quick mode by default
  const [step, setStep] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [smartwatchData, setSmartWatchData] = useState<File[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<Partial<HydrationProfile> | null>(null);
  const [rawSmartWatchData, setRawSmartWatchData] = useState<any>(null);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [honeypot, setHoneypot] = useState(''); // Bot protection
  const [profile, setProfile] = useState<Partial<HydrationProfile>>({
    primaryGoal: 'performance',
    disciplines: [],
    // Simple mode defaults (hidden from user)
    trainingTempRange: { min: 15, max: 20 },
    humidity: 50,
    altitude: 'sea-level',
    sunExposure: 'partial',
    windConditions: 'calm',
    clothingType: 'light',
    sweatRate: 'medium',
    sweatSaltiness: 'medium',
    dailySaltIntake: 'medium',
  });

  const updateProfile = (updates: Partial<HydrationProfile>) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    // Update validation warnings on profile change
    setValidationWarnings(getValidationWarnings(newProfile));
  };

  // Analyze uploaded smartwatch files
  const analyzeSmartWatchFiles = async (files: File[]): Promise<Partial<HydrationProfile>> => {
    setIsAnalyzing(true);
    
    try {
      // Parse smartwatch files (Garmin or Whoop)
      const { profile: extractedData, rawData } = await parseSmartWatchFiles(files);
      
      // Store raw data for enhanced calculations
      setRawSmartWatchData(rawData);
      
      setIsAnalyzing(false);
      
      if (Object.keys(extractedData).length > 0) {
        toast.success('Smartwatch data analyzed successfully!');
      }
      
      return extractedData;
    } catch (error) {
      console.error('Error analyzing smartwatch files:', error);
      toast.error('Error analyzing smartwatch data');
      setIsAnalyzing(false);
      return {};
    }
  };

  // Determine which steps to skip based on analyzed data and version
  const shouldSkipStep = (stepNumber: number): boolean => {
    if (!analyzedData) return false;
    
    // Simple mode only has steps 1 (body) and 2 (activity)
    if (version === 'simple') {
      return false; // Never skip in simple mode
    }
    
    // Pro mode step skipping
    switch (stepNumber) {
      case 1: // Activity & Terrain - NEVER SKIP
        return false;
      case 2: // Body & Physiology - skip if we have all data
        return !!(analyzedData.age && analyzedData.restingHeartRate);
      case 3: // Environmental Conditions - skip if we have data
        return false; // Never skip, user must choose
      case 4: // Sweat Profile - skip if we have inferred data
        return !!(analyzedData.sweatRate && analyzedData.sweatSaltiness);
      default:
        return false;
    }
  };

  // Get next non-skipped step based on version
  const getNextStep = (currentStep: number): number => {
    if (version === 'simple') {
      // Simple mode: 0 (consent) -> 1 (body) -> 2 (activity) -> complete
      const simpleSteps = [0, 1, 2];
      const currentIndex = simpleSteps.indexOf(currentStep);
      return currentIndex >= 0 && currentIndex < simpleSteps.length - 1 
        ? simpleSteps[currentIndex + 1] 
        : 999; // Complete
    }
    
    // Pro mode: skip based on smartwatch data
    let nextStep = currentStep + 1;
    while (nextStep <= 6 && shouldSkipStep(nextStep)) {
      nextStep++;
    }
    return nextStep;
  };

  const isStepValid = (): boolean => {
    const result = (() => {
      switch (step) {
        case 0:
          return version !== null && consentGiven;
        case 1:
          // Activity & Terrain validation
          // Check if race distance is required
          const needsRaceDistance = profile.hasUpcomingRace;
          const hasRequiredRaceDistance = needsRaceDistance ? profile.raceDistance : true;
          
          // Simple mode: just need basic activity info + terrain + race distance if applicable
          if (version === 'simple') {
            const isValid = !!(profile.disciplines && profile.disciplines.length > 0 && 
                     profile.terrain && profile.sessionDuration && hasRequiredRaceDistance);
            console.log('Step 1 (Simple) Validation:', {
              disciplines: profile.disciplines,
              terrain: profile.terrain,
              sessionDuration: profile.sessionDuration,
              hasUpcomingRace: profile.hasUpcomingRace,
              raceDistance: profile.raceDistance,
              needsRaceDistance,
              hasRequiredRaceDistance,
              isValid
            });
            return isValid;
          }
          // Pro mode: need full activity details + terrain + race distance if applicable
          return !!(profile.disciplines && profile.disciplines.length > 0 && 
                   profile.terrain && profile.sessionDuration && profile.indoorOutdoor && hasRequiredRaceDistance);
        case 2:
          return !!(profile.age && profile.sex && profile.height && profile.weight);
        case 3:
          return !!(profile.trainingTempRange && profile.humidity !== undefined && profile.altitude && 
                    profile.sunExposure && profile.windConditions && profile.clothingType);
        case 4:
          return !!(profile.sweatRate && profile.sweatSaltiness);
        case 5:
          return !!(profile.dailySaltIntake);
        case 6:
          return !!(profile.primaryGoal);
        default:
          return false;
      }
    })();
    return result;
  };

  const handleNextStep = async () => {
    if (step === 0 && smartwatchData.length > 0 && !analyzedData) {
      // Analyze files on first step
      const data = await analyzeSmartWatchFiles(smartwatchData);
      setAnalyzedData(data);
      updateProfile(data);
      setStep(getNextStep(0));
    } else {
      const nextStep = getNextStep(step);
      if (nextStep === 999) {
        // Simple mode complete
        handleComplete();
      } else {
        setStep(nextStep);
      }
    }
  };

  const handleComplete = async () => {
    if (isStepValid()) {
      // Bot protection - if honeypot field is filled, it's a bot
      if (honeypot) {
        toast.error('Spam detected. Please try again.');
        return;
      }
      
      setIsGenerating(true);
      
      // Apply defaults for Simple mode before calculations
      const completeProfile = { ...profile };
      if (version === 'simple') {
        // Apply default values that are hidden from user in Simple mode
        if (!completeProfile.sex) completeProfile.sex = 'male';
        if (!completeProfile.indoorOutdoor) completeProfile.indoorOutdoor = 'outdoor';
      }
      
      try {
        // Validate and sanitize profile data before submission
        const validatedProfile = validateAndSanitizeProfile(completeProfile);
        
        // Save profile data to backend with GDPR compliance
        const { data, error } = await supabase.functions.invoke('save-hydration-profile', {
          body: {
            profile: validatedProfile,
            plan: calculateHydrationPlan(completeProfile as HydrationProfile),
            hasSmartWatchData: !!analyzedData && smartwatchData.length > 0,
            consentGiven,
            userEmail: null // Optional: could add email field for users who want to save
          }
        });

        if (error) {
          if (import.meta.env.DEV) {
            console.error('Error saving profile:', error);
          }
          toast.error('Failed to save profile. Your hydration plan will still be displayed.');
        } else if (data?.deletionToken) {
          // Store deletion token securely in localStorage for GDPR data deletion
          localStorage.setItem('hydration_deletion_token', data.deletionToken);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to save profile:', error);
        }
        
        // Show validation error to user
        if (error instanceof Error) {
          toast.error(error.message);
          setIsGenerating(false);
          return; // Don't show plan if validation fails
        }
        
        toast.error('Failed to save profile. Your hydration plan will still be displayed.');
      }
      
      // Update profile with complete values before showing plan
      setProfile(completeProfile);
      
      // Add a minimum delay for smooth transition
      setTimeout(() => {
        setIsGenerating(false);
        setShowPlan(true);
      }, 1500);
    }
  };

  const handleReset = () => {
    setVersion(null);
    setStep(0);
    setShowPlan(false);
    setIsGenerating(false);
    setConsentGiven(false);
    setSmartWatchData([]);
    setAnalyzedData(null);
    setRawSmartWatchData(null);
    setIsAnalyzing(false);
    setProfile({
      sweatRate: 'medium',
      sweatSaltiness: 'medium',
      dailySaltIntake: 'medium',
      primaryGoal: 'performance',
      disciplines: [],
      trainingTempRange: { min: 15, max: 20 },
      humidity: 50,
      altitude: 'sea-level',
      sunExposure: 'partial',
      windConditions: 'calm',
      clothingType: 'light',
    });
  };

  const toggleDiscipline = (discipline: string) => {
    const current = profile.disciplines || [];
    if (current.includes(discipline)) {
      updateProfile({ disciplines: current.filter(d => d !== discipline) });
    } else {
      updateProfile({ disciplines: [...current, discipline] });
    }
  };

  // Show generating animation
  if (isGenerating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-6 animate-fade-in">
          <img 
            src={supplmeLogo} 
            alt="Supplme" 
            className="h-32 mx-auto animate-pulse" 
          />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Generating Your Complete Hydration Guide</h2>
            <p className="text-muted-foreground">by Supplme</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (showPlan && profile as HydrationProfile) {
    const plan = calculateHydrationPlan(profile as HydrationProfile, rawSmartWatchData);
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <HydrationPlanDisplay 
            plan={plan} 
            profile={profile as HydrationProfile} 
            onReset={handleReset}
            hasSmartWatchData={!!analyzedData && smartwatchData.length > 0}
            rawSmartWatchData={rawSmartWatchData}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-6 pb-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header - Shows on all steps */}
        <div className="text-center space-y-3">
          <div className="flex justify-end mb-4">
            <LanguageSwitcher />
          </div>
          <img src={supplmeLogo} alt="Supplme" className="h-32 mx-auto" />
          <h1 className="text-3xl font-bold tracking-tight">
            {t('app.title')}
          </h1>
          {step === 0 && (
            <p className="text-lg text-muted-foreground">
              {t('app.subtitle')}
            </p>
          )}
        </div>

        {/* Honeypot field - hidden from real users, visible to bots */}
        <input
          type="text"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          style={{
            position: 'absolute',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
          }}
          aria-hidden="true"
        />

        {/* Progress */}
        {step > 0 && !isAnalyzing && <ProgressBar currentStep={step} totalSteps={version === 'simple' ? 2 : 6} />}

        {/* Analyzing Indicator */}
        {isAnalyzing && (
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-6">
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <div className="space-y-1">
                <p className="font-semibold text-primary">{t('analyzing.title')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('analyzing.processing').replace('{count}', smartwatchData.length.toString())}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Profile Progress Indicator - Only show in Pro mode */}
        {step > 0 && !isGenerating && version === 'pro' && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 animate-fade-in">
            <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-2">
              ✓ {analyzedData ? 'Data analysis complete! We pre-filled:' : 'Profile progress:'}
            </p>
            <ul className="text-xs text-green-600 dark:text-green-400 space-y-1">
              {/* Body & Physiology */}
              {profile.age && <li>• Age: {profile.age} years</li>}
              {profile.sex && <li>• Sex: {profile.sex}</li>}
              {profile.height && <li>• Height: {profile.height} cm</li>}
              {profile.weight && <li>• Weight: {profile.weight} kg</li>}
              {profile.restingHeartRate && <li>• Resting heart rate: {profile.restingHeartRate} bpm</li>}
              {profile.hrv && <li>• Heart rate variability: {profile.hrv} ms</li>}
              
              {/* Activity */}
              {profile.disciplines && profile.disciplines.length > 0 && (
                <li>• Activity: {profile.disciplines.join(', ')}{analyzedData?.disciplines ? ' (from your data - you still choose your guide)' : ''}</li>
              )}
              {profile.sessionDuration && <li>• Duration: {profile.sessionDuration} hours</li>}
              {version === 'pro' && profile.indoorOutdoor && <li>• Environment: {profile.indoorOutdoor}</li>}
              
              {/* Environmental (Pro mode) */}
              {version === 'pro' && profile.trainingTempRange && (
                <li>• Temperature: {profile.trainingTempRange.min}-{profile.trainingTempRange.max}°C</li>
              )}
              {version === 'pro' && profile.altitude && <li>• Altitude: {profile.altitude}</li>}
              
              {/* Sweat Profile (Pro mode) */}
              {version === 'pro' && profile.sweatRate && <li>• Sweat rate: {profile.sweatRate}</li>}
              {version === 'pro' && profile.sweatSaltiness && <li>• Sweat saltiness: {profile.sweatSaltiness}</li>}
            </ul>
            {analyzedData && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                {t('analysis.skipping')}
              </p>
            )}
          </div>
        )}

        {/* Validation Warnings */}
        {validationWarnings.length > 0 && step > 0 && (
          <div className="space-y-2">
            {validationWarnings.map((warning, index) => (
              <ValidationWarning key={index} message={warning} />
            ))}
          </div>
        )}

        {/* STEP 0: Version Selection & Consent */}
        {step === 0 && !isAnalyzing && (
          <QuestionnaireStep
            title={t('app.title')}
            description={t('app.subtitle')}
            onNext={handleNextStep}
            isValid={isStepValid()}
            nextButtonText={t('common.start')}
          >
            <div className="py-6 space-y-6">
              {/* Version Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">{t('version.select')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Quick Version Button */}
                  <button
                    type="button"
                    onClick={() => setVersion('simple')}
                    className={`p-6 rounded-lg border-2 transition-all text-left ${
                      version === 'simple'
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">{t('version.simple.title')}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t('version.simple.description')}
                      </p>
                      <div className="text-xs text-muted-foreground mt-3">
                        <strong>{t('version.simple.time')}</strong>
                      </div>
                    </div>
                  </button>

                  {/* Pro Version Button */}
                  <button
                    type="button"
                    onClick={() => setVersion('pro')}
                    className={`p-6 rounded-lg border-2 transition-all text-left ${
                      version === 'pro'
                        ? 'border-primary bg-primary/5 shadow-md'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">{t('version.pro.title')}</h3>
                      <p className="text-sm text-muted-foreground">
                        {t('version.pro.description')}
                      </p>
                      <div className="text-xs text-muted-foreground mt-3">
                        <strong>{t('version.pro.time')}</strong>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Optional Smartwatch Upload - Pro version only */}
              {version === 'pro' && (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 sm:p-6 rounded-lg space-y-4">
                <div>
                  <h4 className="font-medium text-sm sm:text-base">{t('upload.title')} <span className="text-blue-600">({t('common.optional')})</span></h4>
                  <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                    {t('upload.description')}
                  </p>
                </div>
                
                <div className="space-y-3">
                  {/* Multiple Files Upload */}
                  <div>
                    <Label htmlFor="smartwatch-files" className="text-sm font-medium mb-2 block">
                      {t('smartwatch.multipleFiles')}
                    </Label>
                    <Input
                      id="smartwatch-files"
                      type="file"
                      multiple
                      accept=".fit,.csv,.json,.xml,.txt"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          setSmartWatchData(prev => [...prev, ...files]);
                          // In a real implementation, parse the files and pre-fill profile
                        }
                      }}
                      className="cursor-pointer"
                    />
                  </div>

                  {/* Folder Upload */}
                  <div>
                    <Label htmlFor="smartwatch-folder" className="text-sm font-medium mb-2 block">
                      {t('smartwatch.uploadFolder')}
                    </Label>
                    <Input
                      id="smartwatch-folder"
                      type="file"
                      // @ts-ignore - webkitdirectory is not in TypeScript types but works in browsers
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          setSmartWatchData(files);
                          // In a real implementation, parse all files and pre-fill profile
                        }
                      }}
                      className="cursor-pointer"
                    />
                  </div>

                  {smartwatchData.length > 0 && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium mb-2">
                        {t('smartwatch.uploaded').replace('{count}', smartwatchData.length.toString())}
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {smartwatchData.map((file, index) => (
                          <div key={index} className="text-xs text-green-600 dark:text-green-400 flex items-center justify-between">
                            <span className="truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => setSmartWatchData(prev => prev.filter((_, i) => i !== index))}
                              className="ml-2 text-red-500 hover:text-red-700"
                              aria-label={t('smartwatch.remove')}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
              
              <div className="bg-muted/50 p-4 sm:p-6 rounded-lg space-y-4">
                <h3 className="font-medium text-base sm:text-lg">{t('gdpr.title')}</h3>
                
                <div className="space-y-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="gdpr-details" className="border-none">
                      <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline py-2">
                        {t('gdpr.compliance.title')}
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3 pt-2">
                        <div>
                          <p className="font-semibold text-foreground mb-1">{t('gdpr.ai.title')}</p>
                          <p>{t('gdpr.ai.description')}</p>
                        </div>
                        
                        <p>{t('gdpr.compliance.intro')}</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li><strong>{t('gdpr.dataCollection')}:</strong> {t('gdpr.dataCollection.text')}</li>
                          <li><strong>{t('gdpr.purpose')}:</strong> {t('gdpr.purpose.text')}</li>
                          <li><strong>{t('gdpr.storage')}:</strong> {t('gdpr.storage.text')}</li>
                          <li><strong>{t('gdpr.rights')}:</strong> {t('gdpr.rights.text')}</li>
                          <li><strong>{t('gdpr.noThirdParties')}:</strong> {t('gdpr.noThirdParties.text')}</li>
                          <li><strong>{t('gdpr.anonymization')}:</strong> {t('gdpr.anonymization.text')}</li>
                        </ul>

                        <div className="pt-2">
                          <p className="font-semibold text-foreground mb-1">{t('gdpr.security.title')}</p>
                          <p>{t('gdpr.security.text')}</p>
                        </div>

                        <div className="text-xs text-muted-foreground pt-2 border-t">
                          <p>{t('gdpr.contact')}</p>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
                
                <div className="flex items-start space-x-3 pt-4 border-t">
                  <Checkbox 
                    id="consent" 
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked === true)}
                  />
                  <label
                    htmlFor="consent"
                    className="text-xs sm:text-sm font-medium leading-relaxed cursor-pointer"
                  >
                    {t('consent.gdpr')}
                  </label>
                </div>
              </div>
              
              <p className="text-center text-sm text-muted-foreground pt-2">
                Designed for endurance athletes: trail runners, triathletes, and ultra competitors
              </p>
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 1: Activity & Terrain */}
        {step === 1 && !isAnalyzing && (
          <QuestionnaireStep
            title="Step 1: Activity & Terrain"
            description="Choose which activity guide you want"
            onNext={handleNextStep}
            onBack={() => setStep(0)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label className="text-lg">{t('activity.primaryDiscipline')} *</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Select the activity you want a hydration guide for
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[
                    { value: 'Running', label: 'Run', icon: '🏃' },
                    { value: 'Swimming', label: 'Swim', icon: '🏊' },
                    { value: 'Cycling', label: 'Bike', icon: '🚴' },
                    { value: 'Triathlon', label: 'Triathlon', icon: '🏅' },
                    { value: 'Hiking', label: 'Hiking', icon: '🥾' },
                  ].map((activity) => (
                    <button
                      key={activity.value}
                      type="button"
                      onClick={() => updateProfile({ disciplines: [activity.value], terrain: undefined })}
                      className={`
                        relative flex flex-col items-center justify-center p-6 rounded-lg border-2 transition-all
                        ${profile.disciplines?.[0] === activity.value
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'
                        }
                      `}
                    >
                      <span className="text-4xl mb-2">{activity.icon}</span>
                      <span className={`text-sm font-medium ${
                        profile.disciplines?.[0] === activity.value ? 'text-primary' : 'text-foreground'
                      }`}>
                        {activity.label}
                      </span>
                      {profile.disciplines?.[0] === activity.value && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <span className="text-primary-foreground text-xs">✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Terrain Selection */}
              {profile.disciplines?.[0] && (
                <div>
                  <Label>
                    {profile.disciplines?.[0] === 'Running' ? 'Running Terrain *' :
                     profile.disciplines?.[0] === 'Swimming' ? 'Swimming Environment *' :
                     profile.disciplines?.[0] === 'Cycling' ? 'Cycling Type *' :
                     profile.disciplines?.[0] === 'Triathlon' ? 'Primary Terrain *' :
                     profile.disciplines?.[0] === 'Hiking' ? 'Hiking Type *' :
                     'Terrain *'}
                  </Label>
                  <RadioGroup
                    value={profile.terrain || ''}
                    onValueChange={(value) => updateProfile({ terrain: value })}
                    className="mt-2"
                  >
                    {profile.disciplines?.[0] === 'Running' && (
                      <>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="road" id="terrain-road" />
                          <Label htmlFor="terrain-road" className="font-normal">Road</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="treadmill" id="terrain-treadmill" />
                          <Label htmlFor="terrain-treadmill" className="font-normal">Treadmill</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="trail" id="terrain-trail" />
                          <Label htmlFor="terrain-trail" className="font-normal">Trail</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="gravel" id="terrain-gravel" />
                          <Label htmlFor="terrain-gravel" className="font-normal">Gravel</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="track" id="terrain-track" />
                          <Label htmlFor="terrain-track" className="font-normal">Track</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mixed" id="terrain-mixed" />
                          <Label htmlFor="terrain-mixed" className="font-normal">Mixed</Label>
                        </div>
                      </>
                    )}
                    {profile.disciplines?.[0] === 'Swimming' && (
                      <>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="indoor-pool" id="terrain-indoor-pool" />
                          <Label htmlFor="terrain-indoor-pool" className="font-normal">Indoor Pool</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="outdoor-pool" id="terrain-outdoor-pool" />
                          <Label htmlFor="terrain-outdoor-pool" className="font-normal">Outdoor Pool</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ocean" id="terrain-ocean" />
                          <Label htmlFor="terrain-ocean" className="font-normal">Ocean/Sea</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="lake" id="terrain-lake" />
                          <Label htmlFor="terrain-lake" className="font-normal">Lake</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="river" id="terrain-river" />
                          <Label htmlFor="terrain-river" className="font-normal">River</Label>
                        </div>
                      </>
                    )}
                    {profile.disciplines?.[0] === 'Cycling' && (
                      <>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="road-bike" id="terrain-road-bike" />
                          <Label htmlFor="terrain-road-bike" className="font-normal">Road Bike</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mountain-bike" id="terrain-mountain-bike" />
                          <Label htmlFor="terrain-mountain-bike" className="font-normal">Mountain Bike</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="gravel-bike" id="terrain-gravel-bike" />
                          <Label htmlFor="terrain-gravel-bike" className="font-normal">Gravel Bike</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="cyclocross" id="terrain-cyclocross" />
                          <Label htmlFor="terrain-cyclocross" className="font-normal">Cyclocross</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mixed-cycling" id="terrain-mixed-cycling" />
                          <Label htmlFor="terrain-mixed-cycling" className="font-normal">Mixed</Label>
                        </div>
                      </>
                    )}
                    {profile.disciplines?.[0] === 'Triathlon' && (
                      <>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="road-triathlon" id="terrain-road-triathlon" />
                          <Label htmlFor="terrain-road-triathlon" className="font-normal">Road Triathlon</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="off-road-triathlon" id="terrain-off-road-triathlon" />
                          <Label htmlFor="terrain-off-road-triathlon" className="font-normal">Off-Road/XTERRA</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mixed-triathlon" id="terrain-mixed-triathlon" />
                          <Label htmlFor="terrain-mixed-triathlon" className="font-normal">Mixed</Label>
                        </div>
                      </>
                    )}
                    {profile.disciplines?.[0] === 'Hiking' && (
                      <>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="day-hike" id="terrain-day-hike" />
                          <Label htmlFor="terrain-day-hike" className="font-normal">Day Hike</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="backpacking" id="terrain-backpacking" />
                          <Label htmlFor="terrain-backpacking" className="font-normal">Backpacking/Multi-Day</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="mountaineering" id="terrain-mountaineering" />
                          <Label htmlFor="terrain-mountaineering" className="font-normal">Mountaineering</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="alpine" id="terrain-alpine" />
                          <Label htmlFor="terrain-alpine" className="font-normal">Alpine</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="trekking" id="terrain-trekking" />
                          <Label htmlFor="terrain-trekking" className="font-normal">Trekking</Label>
                        </div>
                      </>
                    )}
                  </RadioGroup>
                </div>
              )}

              <div>
                <Label htmlFor="raceDistance">Distance *</Label>
                <Input
                  id="raceDistance"
                  value={profile.raceDistance || ''}
                  onChange={(e) => updateProfile({ raceDistance: e.target.value })}
                  placeholder={
                    profile.disciplines?.[0] === 'Running' ? 'e.g., 5K, 10K, Half Marathon, Marathon, 50K' :
                    profile.disciplines?.[0] === 'Cycling' ? 'e.g., 25 miles, 50 miles, 100 miles (Century)' :
                    profile.disciplines?.[0] === 'Swimming' ? 'e.g., 1500m, 5K, 10K' :
                    profile.disciplines?.[0] === 'Triathlon' ? 'e.g., Sprint, Olympic, Half Ironman (70.3), Ironman' :
                    'e.g., Half Marathon, Marathon, 50K'
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center">
                    <Label htmlFor="sessionDuration">
                      {t('activity.sessionDuration')} *
                    </Label>
                    <InfoTooltip content="How long is your typical training session or race? Include warm-up and cool-down time." />
                  </div>
                  <Input
                    id="sessionDuration"
                    type="number"
                    step="0.5"
                    value={profile.sessionDuration || ''}
                    onChange={(e) => updateProfile({ sessionDuration: parseFloat(e.target.value) })}
                    placeholder="Average"
                  />
                </div>
                <div>
                  <Label htmlFor="longestSession">
                    {t('activity.longestSession')}
                  </Label>
                  <Input
                    id="longestSession"
                    type="number"
                    step="0.5"
                    value={profile.longestSession || ''}
                    onChange={(e) => updateProfile({ longestSession: parseFloat(e.target.value) })}
                    placeholder="Max"
                  />
                </div>
              </div>

              {/* Race Planning Section */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-4">
                <h3 className="font-semibold text-sm">Race Day Planning</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasUpcomingRace"
                    checked={!!profile.hasUpcomingRace}
                    onCheckedChange={(checked) => {
                      updateProfile({ 
                        hasUpcomingRace: Boolean(checked),
                        ...(checked === false && { upcomingEvents: '' })
                      });
                    }}
                  />
                  <Label htmlFor="hasUpcomingRace" className="font-normal">
                    I want a race-specific hydration guide
                  </Label>
                </div>
                
                {profile.hasUpcomingRace && (
                  <div>
                    <Label htmlFor="upcomingEvents">
                      {profile.disciplines?.[0] === 'Hiking' ? 'Your Upcoming Hike/Trek' : 'Your Upcoming Race'}
                    </Label>
                    <Input
                      id="upcomingEvents"
                      value={profile.upcomingEvents || ''}
                      onChange={(e) => updateProfile({ upcomingEvents: e.target.value })}
                      placeholder={
                        profile.disciplines?.[0] === 'Running' ? 'e.g., 5K, 10K, Half Marathon, Marathon, 50K Ultra' :
                        profile.disciplines?.[0] === 'Cycling' ? 'e.g., 50 Mile Race, Century (100 miles), Gran Fondo, Multi-day Tour' :
                        profile.disciplines?.[0] === 'Swimming' ? 'e.g., 1.5K Open Water, 5K Swim, 10K Marathon Swim' :
                        profile.disciplines?.[0] === 'Triathlon' ? 'e.g., Sprint Tri, Olympic Tri, Half Ironman (70.3), Full Ironman' :
                        profile.disciplines?.[0] === 'Hiking' ? 'e.g., 10km Day Hike, 30km Trek, Tour du Mont Blanc, Kilimanjaro' :
                        'e.g., Half Marathon, Marathon, Ironman 70.3, Ultra 50K'
                      }
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {profile.disciplines?.[0] === 'Hiking' 
                        ? "We'll create a specialized hydration strategy for your hike or trek"
                        : "We'll create a specialized race day hydration strategy based on your event"
                      }
                    </p>
                  </div>
                )}
              </div>

              {profile.disciplines?.[0] === 'Triathlon' ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="swimPace">Swim Pace</Label>
                    <Input
                      id="swimPace"
                      value={profile.swimPace || ''}
                      onChange={(e) => updateProfile({ swimPace: e.target.value })}
                      placeholder="e.g., 1:45/100m"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bikePower">Bike Power/Pace</Label>
                    <Input
                      id="bikePower"
                      value={profile.bikePower || ''}
                      onChange={(e) => updateProfile({ bikePower: e.target.value })}
                      placeholder="e.g., 250W or 30 km/h"
                    />
                  </div>
                  <div>
                    <Label htmlFor="runPace">Run Pace</Label>
                    <Input
                      id="runPace"
                      value={profile.runPace || ''}
                      onChange={(e) => updateProfile({ runPace: e.target.value })}
                      placeholder="e.g., 5:30/km"
                    />
                  </div>
                </div>
              ) : profile.disciplines?.[0] === 'Swimming' ? (
                <div>
                  <Label htmlFor="avgPace">Average Swim Pace</Label>
                  <Input
                    id="avgPace"
                    value={profile.avgPace || ''}
                    onChange={(e) => updateProfile({ avgPace: e.target.value })}
                    placeholder="e.g., 1:45/100m"
                  />
                </div>
              ) : profile.disciplines?.[0] === 'Cycling' ? (
                <div>
                  <Label htmlFor="avgPace">Average Power/Speed</Label>
                  <Input
                    id="avgPace"
                    value={profile.avgPace || ''}
                    onChange={(e) => updateProfile({ avgPace: e.target.value })}
                    placeholder="e.g., 250W or 30 km/h"
                  />
                </div>
              ) : profile.disciplines?.[0] === 'Hiking' ? (
                <div>
                  <Label htmlFor="avgPace">Average Hiking Pace</Label>
                  <Input
                    id="avgPace"
                    value={profile.avgPace || ''}
                    onChange={(e) => updateProfile({ avgPace: e.target.value })}
                    placeholder="e.g., 3-4 km/hr or 15-20 min/km"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="avgPace">Average Run Pace</Label>
                  <Input
                    id="avgPace"
                    value={profile.avgPace || ''}
                    onChange={(e) => updateProfile({ avgPace: e.target.value })}
                    placeholder="e.g., 5:30/km"
                  />
                </div>
              )}

              {/* Training Location */}
              {version === 'pro' && (
                <div>
                  <div className="flex items-center">
                    <Label>Training Location</Label>
                    <InfoTooltip content="Indoor environments typically have lower fluid loss due to controlled temperature and airflow." />
                  </div>
                  <RadioGroup
                    value={profile.indoorOutdoor || ''}
                    onValueChange={(value) => updateProfile({ indoorOutdoor: value as 'indoor' | 'outdoor' | 'both' })}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="indoor" id="indoor" />
                      <Label htmlFor="indoor" className="font-normal">Indoor</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="outdoor" id="outdoor" />
                      <Label htmlFor="outdoor" className="font-normal">Outdoor</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" />
                      <Label htmlFor="both" className="font-normal">Both</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 2: Body & Physiology */}
        {step === 2 && !isAnalyzing && (
          <QuestionnaireStep
            title="Step 2: Body & Physiology"
            description={analyzedData ? "Complete any missing information" : "Basic information to calculate your hydration needs"}
            onNext={handleNextStep}
            onBack={() => setStep(1)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name (Optional)</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={profile.fullName || ''}
                  onChange={(e) => updateProfile({ fullName: e.target.value })}
                  placeholder="Your full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">{t('body.age')} *</Label>
                  <Input
                    id="age"
                    type="number"
                    value={profile.age || ''}
                    onChange={(e) => updateProfile({ age: parseInt(e.target.value) })}
                    placeholder={t('body.age')}
                  />
                </div>
                <div>
                  <div className="flex items-center">
                    <Label htmlFor="weight">{t('body.weight')} *</Label>
                    <InfoTooltip content={t('body.tooltip.weight')} />
                  </div>
                  <Input
                    id="weight"
                    type="number"
                    value={profile.weight || ''}
                    onChange={(e) => updateProfile({ weight: parseInt(e.target.value) })}
                    placeholder={t('body.weight')}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="height">{t('body.height')} *</Label>
                <Input
                  id="height"
                  type="number"
                  value={profile.height || ''}
                  onChange={(e) => updateProfile({ height: parseInt(e.target.value) })}
                  placeholder={t('body.height')}
                />
              </div>

              <div>
                <Label>{t('body.sex')} *</Label>
                <RadioGroup
                  value={profile.sex || ''}
                  onValueChange={(value) => updateProfile({ sex: value as 'male' | 'female' | 'other' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male" className="font-normal">{t('body.male')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <Label htmlFor="female" className="font-normal">{t('body.female')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="font-normal">{t('body.other')}</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Advanced metrics - Pro mode only */}
              {version === 'pro' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center">
                        <Label htmlFor="bodyFat">{t('body.bodyFat')}</Label>
                        <InfoTooltip content="Body fat percentage affects hydration needs - lower body fat means more body water. Can be measured with smart scales, DEXA scans, or found in Garmin Index, Apple Watch (requires third-party apps), or fitness assessments. Typical athletic range: 6-24% (men), 14-31% (women)." />
                      </div>
                      <Input
                        id="bodyFat"
                        type="number"
                        value={profile.bodyFat || ''}
                        onChange={(e) => updateProfile({ bodyFat: parseFloat(e.target.value) })}
                        placeholder={t('common.optional')}
                      />
                    </div>
                    <div>
                      <div className="flex items-center">
                        <Label htmlFor="restingHeartRate">{t('body.restingHR')}</Label>
                        <InfoTooltip content="Resting heart rate (RHR) indicates fitness level and recovery. Lower RHR typically means better cardiovascular fitness. Find it on: Garmin (morning report), Apple Watch (Health app), Coros (training status), Whoop (daily metrics), Oura Ring. Typical athletic range: 40-60 bpm." />
                      </div>
                      <Input
                        id="restingHeartRate"
                        type="number"
                        value={profile.restingHeartRate || ''}
                        onChange={(e) => updateProfile({ restingHeartRate: parseInt(e.target.value) })}
                        placeholder="bpm"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center">
                      <Label htmlFor="hrv">{t('body.hrv')}</Label>
                      <InfoTooltip content="Heart Rate Variability measures recovery status. Found in fitness watches (Garmin, Apple Watch, Whoop). Low HRV = poor recovery, may need extra hydration. Normal range varies by individual - check your baseline." />
                    </div>
                    <Input
                      id="hrv"
                      value={profile.hrv || ''}
                      onChange={(e) => updateProfile({ hrv: e.target.value })}
                      placeholder="If tracked via Garmin/Whoop/Oura"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center">
                        <Label htmlFor="sleepHours">{t('body.avgSleep')}</Label>
                        <InfoTooltip content="Sleep duration affects recovery and hydration needs. Track via Garmin, Apple Watch, Whoop, Oura Ring, or Coros. Aim for 7-9 hours for optimal athletic performance." />
                      </div>
                      <Input
                        id="sleepHours"
                        type="number"
                        step="0.5"
                        value={profile.sleepHours || ''}
                        onChange={(e) => updateProfile({ sleepHours: parseFloat(e.target.value) })}
                        placeholder="hours/night"
                      />
                    </div>
                    <div>
                      <div className="flex items-center">
                        <Label htmlFor="sleepQuality">{t('body.sleepQuality')}</Label>
                        <InfoTooltip content="Rate your sleep quality from 1 (poor) to 10 (excellent). Many wearables provide a sleep score. Poor sleep impacts recovery and may increase hydration needs." />
                      </div>
                      <Input
                        id="sleepQuality"
                        type="number"
                        min="1"
                        max="10"
                        value={profile.sleepQuality || ''}
                        onChange={(e) => updateProfile({ sleepQuality: parseInt(e.target.value) })}
                        placeholder="1-10"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <Label htmlFor="healthConditions">{t('body.healthConditions')}</Label>
                <Input
                  id="healthConditions"
                  value={profile.healthConditions || ''}
                  onChange={(e) => updateProfile({ healthConditions: e.target.value })}
                  placeholder="e.g., hypertension, kidney issues"
                />
              </div>

              {/* Sweat Sodium Test - Pro Mode Only */}
              {version === 'pro' && (
                <div>
                  <div className="flex items-center">
                    <Label htmlFor="sweatSodiumTest">{t('body.sweatSodiumTest')}</Label>
                    <InfoTooltip content="A sweat sodium test measures the concentration of sodium in your sweat. Normal range is 20-80 mmol/L. High sodium loss (>60 mmol/L) means you need more electrolytes. Can be done at sports labs or with at-home test kits." />
                  </div>
                  <Input
                    id="sweatSodiumTest"
                    type="number"
                    value={profile.sweatSodiumTest || ''}
                    onChange={(e) => updateProfile({ sweatSodiumTest: parseFloat(e.target.value) })}
                    placeholder="If known"
                  />
                </div>
              )}
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 3: Environment Data */}
        {step === 3 && !isAnalyzing && (
          <QuestionnaireStep
            title={t('step.3.title')}
            description="Training conditions affect your hydration needs"
            onNext={handleNextStep}
            onBack={() => setStep(2)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label>Training Temperature Range (°C) *</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <Input
                    type="number"
                    value={profile.trainingTempRange?.min || ''}
                    onChange={(e) => updateProfile({ 
                      trainingTempRange: { 
                        min: parseInt(e.target.value), 
                        max: profile.trainingTempRange?.max || 25 
                      } 
                    })}
                    placeholder={t('env.tempMin')}
                  />
                  <Input
                    type="number"
                    value={profile.trainingTempRange?.max || ''}
                    onChange={(e) => updateProfile({ 
                      trainingTempRange: { 
                        min: profile.trainingTempRange?.min || 15, 
                        max: parseInt(e.target.value) 
                      } 
                    })}
                    placeholder={t('env.tempMax')}
                  />
                </div>
              </div>

              <div>
                <Label>Race Temperature Range (°C)</Label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <Input
                    type="number"
                    value={profile.raceTempRange?.min || ''}
                    onChange={(e) => updateProfile({ 
                      raceTempRange: { 
                        min: parseInt(e.target.value), 
                        max: profile.raceTempRange?.max || 25 
                      } 
                    })}
                    placeholder="Min"
                  />
                  <Input
                    type="number"
                    value={profile.raceTempRange?.max || ''}
                    onChange={(e) => updateProfile({ 
                      raceTempRange: { 
                        min: profile.raceTempRange?.min || 15, 
                        max: parseInt(e.target.value) 
                      } 
                    })}
                    placeholder="Max"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center">
                  <Label htmlFor="humidity">{t('env.humidity')} *</Label>
                  <InfoTooltip content="High humidity (>70%) reduces sweat evaporation, increasing heat stress and fluid needs. Check weather apps for humidity levels." />
                </div>
                <Input
                  id="humidity"
                  type="number"
                  value={profile.humidity || ''}
                  onChange={(e) => updateProfile({ humidity: parseInt(e.target.value) })}
                  placeholder="e.g., 60"
                />
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('env.altitude')} *</Label>
                  <InfoTooltip content="Sea-level: 0-1000m, Moderate: 1000-2500m, High: >2500m. Higher altitude increases respiratory fluid loss and dehydration risk." />
                </div>
                <RadioGroup
                  value={profile.altitude || ''}
                  onValueChange={(value) => updateProfile({ altitude: value as 'sea-level' | 'moderate' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sea-level" id="sea-level" />
                    <Label htmlFor="sea-level" className="font-normal">{t('env.seaLevel')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate" />
                    <Label htmlFor="moderate" className="font-normal">{t('env.moderateAltitude')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high" className="font-normal">{t('env.highAltitude')}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('env.sunExposure')} *</Label>
                  <InfoTooltip content="Direct sun exposure increases body temperature and sweat rate significantly compared to shade." />
                </div>
                <RadioGroup
                  value={profile.sunExposure || ''}
                  onValueChange={(value) => updateProfile({ sunExposure: value as 'shade' | 'partial' | 'full-sun' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="shade" id="shade" />
                    <Label htmlFor="shade" className="font-normal">{t('env.shade')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partial" id="partial" />
                    <Label htmlFor="partial" className="font-normal">{t('env.partial')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full-sun" id="full-sun" />
                    <Label htmlFor="full-sun" className="font-normal">{t('env.fullSun')}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>{t('env.wind')} *</Label>
                <RadioGroup
                  value={profile.windConditions || ''}
                  onValueChange={(value) => updateProfile({ windConditions: value as 'calm' | 'moderate' | 'windy' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="calm" id="calm" />
                    <Label htmlFor="calm" className="font-normal">{t('env.calm')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate-wind" />
                    <Label htmlFor="moderate-wind" className="font-normal">{t('env.moderateWind')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="windy" id="windy" />
                    <Label htmlFor="windy" className="font-normal">{t('env.windy')}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>{t('env.clothing')} *</Label>
                <RadioGroup
                  value={profile.clothingType || ''}
                  onValueChange={(value) => updateProfile({ clothingType: value as 'minimal' | 'light' | 'moderate' | 'heavy' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="minimal" id="minimal" />
                    <Label htmlFor="minimal" className="font-normal">{t('env.minimal')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="font-normal">{t('env.light')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate-cloth" />
                    <Label htmlFor="moderate-cloth" className="font-normal">{t('env.moderateClothing')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="heavy" id="heavy" />
                    <Label htmlFor="heavy" className="font-normal">{t('env.heavy')}</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 4: Sweat Profile */}
        {step === 4 && !isAnalyzing && (
          <QuestionnaireStep
            title={t('step.4.title')}
            description={analyzedData ? "Complete any missing information" : "Understanding your sweat rate and saltiness helps optimize electrolyte intake"}
            onNext={handleNextStep}
            onBack={() => setStep(3)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium text-sm">How to Determine Your Sweat Profile:</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p><strong>Sweat Rate:</strong> Weigh yourself before and after a 1-hour workout. Weight loss (in kg) × 1000 + fluids consumed = sweat rate in ml/hour. High: &gt;1000ml/h, Medium: 500-1000ml/h, Low: &lt;500ml/h.</p>
                  <p><strong>Sweat Saltiness:</strong> After exercise, check your skin and clothing. White crystalline residue = high salt loss. No visible residue = low salt loss. Can also be measured with sweat sodium test kits.</p>
                  <p className="text-xs pt-2">💡 Found in: Garmin (Body Battery + Performance Widget), Coros (Training Insights), Whoop (Strain & Recovery), or manual weighing method.</p>
                </div>
              </div>
              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('sweat.rate')} *</Label>
                  <InfoTooltip content="Your sweat rate affects hydration needs. If you're unsure, choose 'medium'. High sweat rate = clothing soaked during exercise. Low = minimal sweating even during hard efforts." />
                </div>
                {analyzedData?.sweatRate && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                    ✓ This data was taken from your smartwatch
                  </p>
                )}
                <RadioGroup
                  value={profile.sweatRate || ''}
                  onValueChange={(value) => updateProfile({ sweatRate: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="sweat-low" />
                    <Label htmlFor="sweat-low" className="font-normal">{t('sweat.low')} (minimal sweating)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="sweat-medium" />
                    <Label htmlFor="sweat-medium" className="font-normal">{t('sweat.medium')} (moderate sweating)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="sweat-high" />
                    <Label htmlFor="sweat-high" className="font-normal">{t('sweat.high')} (heavy sweating)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('sweat.saltiness')} *</Label>
                  <InfoTooltip content="Salty sweat = white residue on skin/clothing after exercise. This indicates higher sodium loss. Can be measured with a sweat sodium test at sports labs or with at-home kits." />
                </div>
                {analyzedData?.sweatSaltiness && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-2">
                    ✓ This data was taken from your smartwatch
                  </p>
                )}
                <RadioGroup
                  value={profile.sweatSaltiness || ''}
                  onValueChange={(value) => updateProfile({ sweatSaltiness: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="salt-low" />
                    <Label htmlFor="salt-low" className="font-normal">{t('sweat.low')} (no white residue)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="salt-medium" />
                    <Label htmlFor="salt-medium" className="font-normal">{t('sweat.medium')} (some residue)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="salt-high" />
                    <Label htmlFor="salt-high" className="font-normal">{t('sweat.high')} (significant white residue)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('sweat.cramping')}</Label>
                  <InfoTooltip content="Exercise-associated muscle cramps often indicate electrolyte imbalance, particularly sodium and magnesium deficiency." />
                </div>
                <RadioGroup
                  value={profile.crampTiming || 'none'}
                  onValueChange={(value) => updateProfile({ crampTiming: value as 'none' | 'early' | 'mid' | 'late' | 'post' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="cramp-none" />
                    <Label htmlFor="cramp-none" className="font-normal">{t('sweat.none')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="early" id="cramp-early" />
                    <Label htmlFor="cramp-early" className="font-normal">{t('sweat.early')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mid" id="cramp-mid" />
                    <Label htmlFor="cramp-mid" className="font-normal">{t('sweat.mid')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="late" id="cramp-late" />
                    <Label htmlFor="cramp-late" className="font-normal">{t('sweat.late')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="post" id="cramp-post" />
                    <Label htmlFor="cramp-post" className="font-normal">{t('sweat.post')}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="hydrationStrategy">Current Hydration Strategy</Label>
                <Textarea
                  id="hydrationStrategy"
                  value={profile.hydrationStrategy || ''}
                  onChange={(e) => updateProfile({ hydrationStrategy: e.target.value })}
                  placeholder="Describe what you currently drink during training/races"
                  rows={3}
                />
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 5: Dietary Habits */}
        {step === 5 && !isAnalyzing && (
          <QuestionnaireStep
            title={t('step.5.title')}
            description="Your everyday nutrition affects hydration needs"
            onNext={handleNextStep}
            onBack={() => setStep(4)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <div className="flex items-center mb-2">
                  <Label>{t('nutrition.saltIntake')} *</Label>
                  <InfoTooltip content="Low: minimal processed foods, no added salt. Medium: normal diet with some salt. High: salty foods regularly, add salt to meals." />
                </div>
                <RadioGroup
                  value={profile.dailySaltIntake || ''}
                  onValueChange={(value) => updateProfile({ dailySaltIntake: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="salt-intake-low" />
                    <Label htmlFor="salt-intake-low" className="font-normal">{t('sweat.low')} (little added salt)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="salt-intake-medium" />
                    <Label htmlFor="salt-intake-medium" className="font-normal">{t('sweat.medium')} (moderate salt)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="salt-intake-high" />
                    <Label htmlFor="salt-intake-high" className="font-normal">{t('sweat.high')} (regular salt use)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="dailyWaterIntake">{t('nutrition.waterIntake')}</Label>
                <Input
                  id="dailyWaterIntake"
                  type="number"
                  step="0.5"
                  value={profile.dailyWaterIntake || ''}
                  onChange={(e) => updateProfile({ dailyWaterIntake: parseFloat(e.target.value) })}
                  placeholder="e.g., 2.5"
                />
              </div>

              <div>
                <div className="flex items-center">
                  <Label htmlFor="caffeineIntake">{t('nutrition.caffeine')}</Label>
                  <InfoTooltip content="Caffeine can have a mild diuretic effect at high doses (>300mg/day), potentially increasing fluid needs. However, regular caffeine users develop tolerance. 1 cup coffee ≈ 95mg, 1 espresso ≈ 64mg, 1 energy drink ≈ 80mg." />
                </div>
                <Input
                  id="caffeineIntake"
                  type="number"
                  value={profile.caffeineIntake || ''}
                  onChange={(e) => updateProfile({ caffeineIntake: parseInt(e.target.value) })}
                  placeholder="e.g., 200 (about 2 cups of coffee)"
                />
              </div>

              <div>
                <Label htmlFor="dietType">{t('nutrition.diet')}</Label>
                <Input
                  id="dietType"
                  value={profile.dietType || ''}
                  onChange={(e) => updateProfile({ dietType: e.target.value })}
                  placeholder="e.g., omnivore, vegetarian, keto"
                />
              </div>

              <div>
                <Label htmlFor="nutritionNotes">Additional Nutrition Notes</Label>
                <Textarea
                  id="nutritionNotes"
                  value={profile.nutritionNotes || ''}
                  onChange={(e) => updateProfile({ nutritionNotes: e.target.value })}
                  placeholder="Any other relevant information about your diet or supplements"
                  rows={3}
                />
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 6: Goals & Events */}
        {step === 6 && !isAnalyzing && (
          <QuestionnaireStep
            title={t('step.6.title')}
            description="Help us tailor your plan to your objectives"
            onNext={handleComplete}
            onBack={() => setStep(5)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label>{t('goals.primary')} *</Label>
                <RadioGroup
                  value={profile.primaryGoal || 'performance'}
                  onValueChange={(value) => updateProfile({ primaryGoal: value as 'performance' | 'health' | 'weight-loss' | 'endurance' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="performance" id="goal-performance" />
                    <Label htmlFor="goal-performance" className="font-normal">{t('goals.performance')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="health" id="goal-health" />
                    <Label htmlFor="goal-health" className="font-normal">{t('goals.health')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weight-loss" id="goal-weight" />
                    <Label htmlFor="goal-weight" className="font-normal">{t('goals.weightLoss')}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="endurance" id="goal-endurance" />
                    <Label htmlFor="goal-endurance" className="font-normal">{t('goals.endurance')}</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="upcomingEvents">{t('goals.upcomingEvents')}</Label>
                <Textarea
                  id="upcomingEvents"
                  value={profile.upcomingEvents || ''}
                  onChange={(e) => updateProfile({ upcomingEvents: e.target.value })}
                  placeholder="List any races or events you're training for"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="specificConcerns">{t('goals.concerns')}</Label>
                <Textarea
                  id="specificConcerns"
                  value={profile.specificConcerns || ''}
                  onChange={(e) => updateProfile({ specificConcerns: e.target.value })}
                  placeholder="Any particular challenges or questions about hydration?"
                  rows={3}
                />
              </div>
            </div>
          </QuestionnaireStep>
        )}
      </div>
    </div>
  );
};

export default Index;
