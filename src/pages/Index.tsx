import { useState } from 'react';
import { HydrationProfile } from '@/types/hydration';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { validateAndSanitizeProfile } from '@/utils/profileValidation';
import { parseSmartWatchFiles } from '@/utils/garminDataParser';
import { calculateTriathlonDuration, getTriathlonBreakdown, TRIATHLON_DISTANCES } from '@/utils/triathlonCalculator';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import { HydrationPlanDisplay } from '@/components/HydrationPlanDisplay';
import { InfoTooltip } from '@/components/InfoTooltip';
import { ValidationWarning, getValidationWarnings } from '@/components/ValidationWarning';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { PaceDurationCalculator } from '@/components/PaceDurationCalculator';
import { useLanguage } from '@/contexts/LanguageContext';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';
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
    // Simple mode defaults (hidden from user) - no temperature default
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
    while (nextStep <= 5 && shouldSkipStep(nextStep)) {
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
          // Training distance is now ALWAYS required (whether racing or training)

          // Simple mode: just need basic activity info + terrain + temperature + distance
          if (version === 'simple') {
            const isValid = !!(profile.disciplines && profile.disciplines.length > 0 &&
              profile.terrain && profile.raceDistance && profile.trainingTempRange?.min);
            console.log('Step 1 (Simple) Validation:', {
              disciplines: profile.disciplines,
              terrain: profile.terrain,
              raceDistance: profile.raceDistance,
              temperature: profile.trainingTempRange?.min,
              isValid
            });
            return isValid;
          }
          // Pro mode: require activity, terrain, and mandatory distance
          return !!(profile.disciplines && profile.disciplines.length > 0 &&
            profile.terrain && profile.raceDistance);
        case 2:
          // Simple mode: require temperature
          if (version === 'simple') {
            return !!(profile.age && profile.sex && profile.height && profile.weight && profile.trainingTempRange?.min);
          }
          // Pro mode: just basic body info
          return !!(profile.age && profile.sex && profile.height && profile.weight);
        case 3:
          return !!(profile.trainingTempRange && profile.humidity !== undefined && profile.altitude &&
            profile.sunExposure && profile.windConditions && profile.clothingType);
        case 4:
          return !!(profile.sweatRate && profile.sweatSaltiness);
        case 5:
          return !!(profile.dailySaltIntake);
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
      setTimeout(() => {
        document.getElementById('questionnaire-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else {
      const nextStep = getNextStep(step);
      if (nextStep === 999) {
        // Simple mode complete
        handleComplete();
      } else {
        setStep(nextStep);
        setTimeout(() => {
          document.getElementById('questionnaire-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  };

  const handleBackStep = (targetStep: number) => {
    setStep(targetStep);
    setTimeout(() => {
      document.getElementById('questionnaire-step')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
        // Temperature is now required and should be provided by user
      }

      // Apply default for Pro mode as well
      if (!completeProfile.indoorOutdoor) completeProfile.indoorOutdoor = 'outdoor';

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
      humidity: 50,
      altitude: 'sea-level',
      sunExposure: 'partial',
      windConditions: 'calm',
      clothingType: 'light',
    });
  };

  const handleResetWithData = () => {
    // Keep profile data, just go back to first step to allow adjustments
    const currentVersion = version;
    setShowPlan(false);
    setIsGenerating(false);
    setStep(currentVersion === 'simple' ? 1 : 1); // Go to activity step
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
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/10 to-background flex items-center justify-center px-4 relative overflow-hidden">
        {/* Athletic background pattern */}
        <div className="absolute inset-0 opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, currentColor 35px, currentColor 36px)',
          }}></div>
        </div>

        <div className="text-center space-y-10 animate-fade-in relative z-10">
          <div className="relative">
            <div className="absolute inset-0 glow-effect blur-3xl opacity-40 animate-pulse"></div>
            <img
              src={supplmeLogo}
              alt="Supplme"
              className="h-40 md:h-48 mx-auto relative z-10 performance-pulse"
            />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter chrome-shine uppercase">
              CRAFTING YOUR ELITE HYDRATION PLAN
            </h2>
            <p className="text-xl md:text-2xl font-bold text-muted-foreground tracking-wide">
              Performance Optimization in Progress...
            </p>
          </div>
          <div className="flex items-center justify-center gap-4">
            <div className="w-4 h-4 bg-chrome rounded-full animate-bounce shimmer shadow-lg" style={{ animationDelay: '0ms' }}></div>
            <div className="w-4 h-4 bg-chrome rounded-full animate-bounce shimmer shadow-lg" style={{ animationDelay: '150ms' }}></div>
            <div className="w-4 h-4 bg-chrome rounded-full animate-bounce shimmer shadow-lg" style={{ animationDelay: '300ms' }}></div>
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
            onReset={handleResetWithData}
            onFullReset={handleReset}
            hasSmartWatchData={!!analyzedData && smartwatchData.length > 0}
            rawSmartWatchData={rawSmartWatchData}
            version={version || undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 relative overflow-hidden pt-6 pb-12 px-4">
      {/* Athletic background pattern */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, currentColor 35px, currentColor 36px)',
        }}></div>
      </div>

      <div className="max-w-2xl mx-auto space-y-8 relative z-10">
        {/* Header - Shows on all steps */}
        <div className="text-center">
          <div className="flex justify-end mb-2">
            <LanguageSwitcher />
          </div>
          <div className="relative inline-block group">
            <div className="absolute inset-0 glow-effect blur-3xl opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
            <img src={supplmeLogo} alt="Supplme" className="h-40 md:h-48 mx-auto relative z-10 transition-transform duration-300 group-hover:scale-105" />
          </div>
          <div className="space-y-2 -mt-2">
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter chrome-shine uppercase">
              {t('app.title')}
            </h1>
            {step === 0 && (
              <p className="text-lg md:text-xl font-semibold text-muted-foreground max-w-lg mx-auto leading-relaxed">
                {t('app.subtitle')}
              </p>
            )}
          </div>

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
          <div className="athletic-card bg-primary/5 border-primary/20 rounded-xl p-6 animate-fade-in">
            <div className="flex items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-primary border-t-transparent shimmer"></div>
              <div className="space-y-1">
                <p className="font-bold text-lg text-primary uppercase tracking-wide">{t('analyzing.title')}</p>
                <p className="text-sm text-muted-foreground font-medium">
                  {t('analyzing.processing').replace('{count}', smartwatchData.length.toString())}
                </p>
              </div>
            </div>
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
              <div className="space-y-5">
                <Label className="text-lg font-bold uppercase tracking-wide chrome-shine">
                  {t('version.select')}
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Quick Version Button */}
                  <button
                    type="button"
                    onClick={() => setVersion('simple')}
                    className={`athletic-card p-6 rounded-xl border-2 transition-all duration-300 text-left group relative overflow-hidden ${version === 'simple'
                      ? 'border-primary bg-primary/10 shadow-lg scale-[1.02] ring-2 ring-primary/20'
                      : 'border-border/30 hover:border-primary/50 hover:shadow-md'
                      }`}
                  >
                    {/* Selected Indicator */}
                    {version === 'simple' && (
                      <div className="absolute top-4 right-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                        <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="space-y-3 relative z-10">
                      <h3 className={`text-xl font-black uppercase tracking-tight transition-colors ${version === 'simple' ? 'text-primary' : ''
                        }`}>
                        {t('version.simple.title')}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t('version.simple.description')}
                      </p>
                      <div className={`text-xs font-bold mt-4 flex items-center gap-2 transition-colors ${version === 'simple' ? 'text-primary' : 'text-primary/80'
                        }`}>
                        <Clock className="w-3 h-3" />
                        {t('version.simple.time')}
                      </div>
                    </div>
                  </button>

                  {/* Pro Version Button */}
                  <button
                    type="button"
                    onClick={() => setVersion('pro')}
                    className={`athletic-card p-6 rounded-xl border-2 transition-all duration-300 text-left group relative overflow-hidden ${version === 'pro'
                      ? 'border-primary bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 shadow-xl scale-[1.02] ring-2 ring-primary/30'
                      : 'border-border/30 hover:border-primary/50 hover:shadow-md hover:bg-primary/5'
                      }`}
                  >
                    {/* Premium Smartwatch Badge */}
                    <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${version === 'pro'
                      ? 'bg-primary text-primary-foreground shadow-lg animate-scale-in'
                      : 'bg-primary/20 text-primary'
                      }`}>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                        <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                        <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
                      </svg>
                      Smartwatch
                    </div>

                    {/* Selected Indicator */}
                    {version === 'pro' && (
                      <div className="absolute top-4 right-4 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                        <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    {/* Animated gradient background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary/20 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="space-y-3 relative z-10 mt-6">
                      <h3 className={`text-xl font-black uppercase tracking-tight transition-colors ${version === 'pro' ? 'text-primary' : ''
                        }`}>
                        {t('version.pro.title')}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t('version.pro.description')}
                      </p>

                      {/* Pro Features Highlight */}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary/90 bg-primary/10 px-2 py-1 rounded-md">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          AI-Powered
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary/90 bg-primary/10 px-2 py-1 rounded-md">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                          </svg>
                          Environmental
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary/90 bg-primary/10 px-2 py-1 rounded-md">
                          <span className="text-sm">🧂</span>
                          Sweat Profile
                        </span>
                      </div>

                      <div className={`text-xs font-bold mt-4 flex items-center gap-2 transition-colors ${version === 'pro' ? 'text-primary' : 'text-primary/80'
                        }`}>
                        <Clock className="w-3 h-3" />
                        {t('version.pro.time')}
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

                <div className="flex items-start space-x-3 pt-4 border-t group">
                  <Checkbox
                    id="consent"
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked === true)}
                    className="mt-1"
                  />
                  <label
                    htmlFor="consent"
                    className="text-sm font-medium leading-relaxed cursor-pointer group-hover:text-foreground/90 transition-colors"
                  >
                    {t('consent.gdpr')}
                  </label>
                </div>
              </div>

              <p className="text-center text-sm text-muted-foreground pt-2">
                For those who train hard, race harder, and expect more from their hydration
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
            onBack={() => handleBackStep(0)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label className="text-lg mb-4 block">{t('activity.primaryDiscipline')} *</Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Select the activity you want a hydration guide for
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { value: 'Running', label: 'Run', icon: '🏃' },
                    { value: 'Swimming', label: 'Swim', icon: '🏊' },
                    { value: 'Cycling', label: 'Bike', icon: '🚴' },
                    { value: 'Triathlon', label: 'Triathlon', icon: '🏅' },
                  ].map((activity) => (
                    <button
                      key={activity.value}
                      type="button"
                      onClick={() => updateProfile({ disciplines: [activity.value], terrain: undefined })}
                      className={`
                        group relative flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-300 hover:scale-105
                        ${profile.disciplines?.[0] === activity.value
                          ? 'border-primary bg-primary/10 shadow-xl shadow-primary/20 scale-105'
                          : 'border-border/50 hover:border-primary/50 hover:bg-muted/50 hover:shadow-lg'
                        }
                      `}
                    >
                      <span className="text-5xl mb-3 transition-transform group-hover:scale-110">{activity.icon}</span>
                      <span className={`text-sm font-bold uppercase tracking-wide transition-colors ${profile.disciplines?.[0] === activity.value ? 'text-primary' : 'text-foreground'
                        }`}>
                        {activity.label}
                      </span>
                      {profile.disciplines?.[0] === activity.value && (
                        <div className="absolute top-3 right-3 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg animate-scale-in">
                          <span className="text-primary-foreground text-sm font-bold">✓</span>
                        </div>
                      )}
                      {/* Subtle gradient overlay on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
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
                            'Terrain *'}
                  </Label>
                  <RadioGroup
                    value={profile.terrain || ''}
                    onValueChange={(value) => updateProfile({ terrain: value })}
                    className="mt-3 space-y-3"
                  >
                    {profile.disciplines?.[0] === 'Running' && (
                      <>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="road" id="terrain-road" />
                          <Label htmlFor="terrain-road" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Road</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="treadmill" id="terrain-treadmill" />
                          <Label htmlFor="terrain-treadmill" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Treadmill</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="trail" id="terrain-trail" />
                          <Label htmlFor="terrain-trail" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Trail</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="gravel" id="terrain-gravel" />
                          <Label htmlFor="terrain-gravel" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Gravel</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="track" id="terrain-track" />
                          <Label htmlFor="terrain-track" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Track</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="mixed" id="terrain-mixed" />
                          <Label htmlFor="terrain-mixed" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Mixed</Label>
                        </label>
                      </>
                    )}
                    {profile.disciplines?.[0] === 'Swimming' && (
                      <>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="indoor-pool" id="terrain-indoor-pool" />
                          <Label htmlFor="terrain-indoor-pool" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Indoor Pool</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="outdoor-pool" id="terrain-outdoor-pool" />
                          <Label htmlFor="terrain-outdoor-pool" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Outdoor Pool</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="ocean" id="terrain-ocean" />
                          <Label htmlFor="terrain-ocean" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Ocean/Sea</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="lake" id="terrain-lake" />
                          <Label htmlFor="terrain-lake" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Lake</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="river" id="terrain-river" />
                          <Label htmlFor="terrain-river" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">River</Label>
                        </label>
                      </>
                    )}
                    {profile.disciplines?.[0] === 'Cycling' && (
                      <>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="road-bike" id="terrain-road-bike" />
                          <Label htmlFor="terrain-road-bike" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Road Bike</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="mountain-bike" id="terrain-mountain-bike" />
                          <Label htmlFor="terrain-mountain-bike" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Mountain Bike</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="gravel-bike" id="terrain-gravel-bike" />
                          <Label htmlFor="terrain-gravel-bike" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Gravel Bike</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="cyclocross" id="terrain-cyclocross" />
                          <Label htmlFor="terrain-cyclocross" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Cyclocross</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="mixed-cycling" id="terrain-mixed-cycling" />
                          <Label htmlFor="terrain-mixed-cycling" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Mixed</Label>
                        </label>
                      </>
                    )}
                    {profile.disciplines?.[0] === 'Triathlon' && (
                      <>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="road-triathlon" id="terrain-road-triathlon" />
                          <Label htmlFor="terrain-road-triathlon" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Road Triathlon</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="off-road-triathlon" id="terrain-off-road-triathlon" />
                          <Label htmlFor="terrain-off-road-triathlon" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Off-Road/XTERRA</Label>
                        </label>
                        <label className="flex items-center space-x-3 p-3 rounded-lg border-2 border-border/30 hover:border-primary/50 hover:bg-muted/30 transition-all duration-300 cursor-pointer group">
                          <RadioGroupItem value="mixed-triathlon" id="terrain-mixed-triathlon" />
                          <Label htmlFor="terrain-mixed-triathlon" className="font-medium cursor-pointer flex-1 group-hover:text-primary transition-colors">Mixed</Label>
                        </label>
                      </>
                    )}
                  </RadioGroup>
                </div>
              )}

              {/* Race Option - Enhanced with Card Style */}
              <div className={`relative p-5 border-2 rounded-xl transition-all duration-300 animate-fade-in ${profile.hasUpcomingRace
                ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                : 'border-primary/50 bg-gradient-to-r from-primary/10 to-primary/20 hover:border-primary hover:shadow-lg hover:shadow-primary/10'
                }`}>
                {/* Recommended Badge */}
                <div className="absolute -top-3 left-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                  RECOMMENDED
                </div>
                <div className="flex items-start gap-3 pt-1">
                  <Checkbox
                    id="hasUpcomingRace"
                    checked={profile.hasUpcomingRace || false}
                    onCheckedChange={(checked) => updateProfile({ hasUpcomingRace: checked === true })}
                    className="mt-1 h-5 w-5 border-2 border-primary"
                  />
                  <div className="flex-1">
                    <Label htmlFor="hasUpcomingRace" className="cursor-pointer text-lg font-bold flex items-center gap-2 text-foreground">
                      🏁 Are you training for a race or specific event?
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Get race-specific hydration guidance with a 48-hour race protocol
                    </p>
                  </div>
                </div>
              </div>

              {profile.hasUpcomingRace && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="raceDistance">Race Distance *</Label>
                    <Input
                      id="raceDistance"
                      value={profile.raceDistance || ''}
                      onChange={(e) => updateProfile({ raceDistance: e.target.value })}
                      placeholder={
                        profile.disciplines?.[0] === 'Running' ? 'e.g., 5K, 10K, Half Marathon, Marathon, 50K' :
                          profile.disciplines?.[0] === 'Cycling' ? 'e.g., 40km, 80km, 160km (Century)' :
                            profile.disciplines?.[0] === 'Swimming' ? 'e.g., 1.5km, 5km, 10km' :
                              profile.disciplines?.[0] === 'Triathlon' ? 'e.g., Sprint, Olympic, Half Ironman (70.3), Ironman' :
                                'e.g., Half Marathon, Marathon, 50K'
                      }
                    />
                  </div>
                  {/* Hide Goal Finish Time for Triathlons - calculated automatically */}
                  {profile.disciplines?.[0] !== 'Triathlon' && (
                    <div className="space-y-2">
                      <Label htmlFor="goalTime">Goal Finish Time (optional)</Label>
                      <Input
                        id="goalTime"
                        value={profile.goalTime || ''}
                        onChange={(e) => updateProfile({ goalTime: e.target.value })}
                        placeholder={
                          profile.disciplines?.[0] === 'Running' ? 'e.g., 0:25:00 for 5km, 1:30:00 for Half Marathon' :
                            profile.disciplines?.[0] === 'Cycling' ? 'e.g., 1:30:00 for 40km, 3:00:00 for 100km' :
                              profile.disciplines?.[0] === 'Swimming' ? 'e.g., 0:20:00 for 1km, 1:00:00 for 5km' :
                                'e.g., 1:30:00 for 1 hour 30 minutes'
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Format: H:MM:SS (e.g., 1:45:00 for 1 hour 45 minutes). Enter your target finish time to calculate required pace.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {!profile.hasUpcomingRace && (
                <div className="space-y-2">
                  <Label htmlFor="trainingDistance">
                    {profile.disciplines?.[0] === 'Triathlon'
                      ? 'Race Type (e.g., Ironman, Olympic) or Distance (km) *'
                      : 'Training Distance (km) *'
                    }
                  </Label>
                  <Input
                    id="trainingDistance"
                    value={profile.raceDistance || ''}
                    onChange={(e) => updateProfile({ raceDistance: e.target.value })}
                    placeholder={
                      profile.disciplines?.[0] === 'Running' ? 'e.g., 5km, 10km, Half Marathon, Marathon' :
                        profile.disciplines?.[0] === 'Cycling' ? 'e.g., 40km, 60km, 100km, Century (160km)' :
                          profile.disciplines?.[0] === 'Swimming' ? 'e.g., 1km, 2km, 5km, 10km' :
                            profile.disciplines?.[0] === 'Triathlon' ? 'e.g., Sprint, Olympic, Half Ironman, Ironman' :
                              'e.g., 10km, Half Marathon'
                    }
                    className="bg-background text-foreground border-border placeholder:text-muted-foreground focus:border-primary focus:ring-primary"
                    required
                  />
                </div>
              )}

              {/* Temperature input - Quick mode */}
              {version === 'simple' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="temperature">
                      {profile.disciplines?.[0] === 'Swimming' ? 'Water Temperature (°C) *' : 'Expected Temperature (°C) *'}
                    </Label>
                    <InfoTooltip content={
                      profile.disciplines?.[0] === 'Swimming'
                        ? "What water temperature do you expect? This helps us calculate your fluid needs during swimming."
                        : "What temperature do you expect during your activity? This helps us calculate your sweat rate and fluid needs."
                    } />
                  </div>
                  <Input
                    id="temperature"
                    type="number"
                    value={profile.trainingTempRange?.min || ''}
                    onChange={(e) => {
                      const temp = parseInt(e.target.value);
                      updateProfile({ trainingTempRange: { min: temp, max: temp } });
                    }}
                    placeholder={profile.disciplines?.[0] === 'Swimming' ? 'e.g., 18' : 'e.g., 20'}
                  />
                </div>
              )}

              {/* Triathlon-specific pace inputs */}
              {profile.disciplines?.[0] === 'Triathlon' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Swim Pace */}
                    <div className="space-y-2">
                      <Label htmlFor="swimPace">Swim Pace</Label>
                      <Input
                        id="swimPace"
                        value={profile.swimPace || ''}
                        onChange={(e) => {
                          const newProfile = { ...profile, swimPace: e.target.value };
                          const duration = calculateTriathlonDuration(newProfile);
                          updateProfile({
                            swimPace: e.target.value,
                            ...(duration && { sessionDuration: duration })
                          });
                        }}
                        placeholder="e.g., 1:45/100m"
                      />
                      <p className="text-xs text-muted-foreground">Min:sec per 100m</p>
                    </div>

                    {/* Bike Speed */}
                    <div className="space-y-2">
                      <Label htmlFor="bikeSpeed">Bike Speed</Label>
                      <Input
                        id="bikeSpeed"
                        value={profile.bikeSpeed || profile.bikePower || ''}
                        onChange={(e) => {
                          const newProfile = { ...profile, bikeSpeed: e.target.value };
                          const duration = calculateTriathlonDuration(newProfile);
                          updateProfile({
                            bikeSpeed: e.target.value,
                            ...(duration && { sessionDuration: duration })
                          });
                        }}
                        placeholder="e.g., 30 km/h"
                      />
                      <p className="text-xs text-muted-foreground">Average speed in km/h</p>
                    </div>

                    {/* Run Pace */}
                    <div className="space-y-2">
                      <Label htmlFor="runPace">Run Pace</Label>
                      <Input
                        id="runPace"
                        value={profile.runPace || ''}
                        onChange={(e) => {
                          const newProfile = { ...profile, runPace: e.target.value };
                          const duration = calculateTriathlonDuration(newProfile);
                          updateProfile({
                            runPace: e.target.value,
                            ...(duration && { sessionDuration: duration })
                          });
                        }}
                        placeholder="e.g., 5:30/km"
                      />
                      <p className="text-xs text-muted-foreground">Min:sec per km</p>
                    </div>
                  </div>

                  {/* Show calculated total time in h:m format */}
                  {(() => {
                    const breakdown = getTriathlonBreakdown(profile);

                    if (breakdown) {
                      const hours = Math.floor(breakdown.total);
                      const remainingMinutes = (breakdown.total % 1) * 60;
                      const minutes = Math.floor(remainingMinutes);
                      const seconds = Math.round((remainingMinutes % 1) * 60);

                      return (
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground mb-2">Total Estimated Time</p>
                          <p className="text-4xl font-black text-primary">
                            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                          </p>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>
              ) : (
                <PaceDurationCalculator
                  discipline={profile.disciplines?.[0] || 'Running'}
                  raceDistance={profile.raceDistance}
                  goalTime={profile.hasUpcomingRace ? profile.goalTime : undefined}
                  currentPace={profile.avgPace}
                  onPaceChange={(pace) => updateProfile({ avgPace: pace })}
                  onDurationChange={(duration) => updateProfile({ sessionDuration: duration })}
                />
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
            onBack={() => handleBackStep(1)}
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
                <div className="space-y-2">
                  <Label htmlFor="age">{t('body.age')} *</Label>
                  <Input
                    id="age"
                    type="number"
                    value={profile.age || ''}
                    onChange={(e) => updateProfile({ age: parseInt(e.target.value) })}
                    placeholder={t('body.age')}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
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

              <div className="space-y-2">
                <Label htmlFor="height">{t('body.height')} *</Label>
                <Input
                  id="height"
                  type="number"
                  value={profile.height || ''}
                  onChange={(e) => updateProfile({ height: parseInt(e.target.value) })}
                  placeholder={t('body.height')}
                />
              </div>

              <div className="space-y-2">
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
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

                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
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

              <div className="space-y-2">
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
            onBack={() => handleBackStep(2)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label>
                  {profile.disciplines?.[0] === 'Swimming'
                    ? 'Water Temperature Range (°C) *'
                    : 'Training Temperature Range (°C) *'}
                </Label>
                {profile.disciplines?.[0] === 'Swimming' && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter the typical water temperature for your swimming sessions
                  </p>
                )}
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
                <Label>
                  {profile.disciplines?.[0] === 'Swimming'
                    ? 'Race Water Temperature Range (°C)'
                    : 'Race Temperature Range (°C)'}
                </Label>
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

              <div className="space-y-2">
                <div className="flex items-center gap-1">
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
                  <InfoTooltip content={version === 'pro' ? "Select range or specify exact altitude below. Sea-level: 0-1000m, Moderate: 1000-2500m, High: >2500m. Higher altitude increases respiratory fluid loss and dehydration risk." : "Sea-level: 0-1000m, Moderate: 1000-2500m, High: >2500m. Higher altitude increases respiratory fluid loss and dehydration risk."} />
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

                {/* Exact altitude in meters - Pro version only */}
                {version === 'pro' && (
                  <div className="mt-3">
                    <Label htmlFor="altitudeMeters" className="text-sm text-muted-foreground">
                      Exact Altitude (meters) - Optional
                    </Label>
                    <Input
                      id="altitudeMeters"
                      type="number"
                      min="0"
                      max="5000"
                      value={profile.altitudeMeters || ''}
                      onChange={(e) => updateProfile({ altitudeMeters: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="e.g., 1500"
                      className="mt-1"
                    />
                  </div>
                )}
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
            onBack={() => handleBackStep(3)}
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
            onNext={handleComplete}
            onBack={() => handleBackStep(4)}
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
      </div>
    </div>
  );
};

export default Index;
