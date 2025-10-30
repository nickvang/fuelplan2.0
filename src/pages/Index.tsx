import { useState } from 'react';
import { HydrationProfile } from '@/types/hydration';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import { HydrationPlanDisplay } from '@/components/HydrationPlanDisplay';
import { InfoTooltip } from '@/components/InfoTooltip';
import { ValidationWarning, getValidationWarnings } from '@/components/ValidationWarning';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import supplmeLogo from '@/assets/supplme-logo-2.svg';

const Index = () => {
  const [step, setStep] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [profile, setProfile] = useState<Partial<HydrationProfile>>({
    sex: 'male',
    indoorOutdoor: 'outdoor',
    altitude: 'sea-level',
    sunExposure: 'partial',
    windConditions: 'moderate',
    clothingType: 'light',
    sweatRate: 'medium',
    sweatSaltiness: 'medium',
    dailySaltIntake: 'medium',
    primaryGoal: 'performance',
    disciplines: [],
  });

  const updateProfile = (updates: Partial<HydrationProfile>) => {
    const newProfile = { ...profile, ...updates };
    setProfile(newProfile);
    // Update validation warnings on profile change
    setValidationWarnings(getValidationWarnings(newProfile));
  };

  const isStepValid = (): boolean => {
    switch (step) {
      case 0:
        return consentGiven;
      case 1:
        return !!(profile.age && profile.sex && profile.height && profile.weight);
      case 2:
        return !!(profile.disciplines && profile.disciplines.length > 0 && profile.sessionDuration && profile.indoorOutdoor);
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
  };

  const handleComplete = () => {
    if (isStepValid()) {
      setShowPlan(true);
    }
  };

  const handleReset = () => {
    setStep(0);
    setShowPlan(false);
    setConsentGiven(false);
    setProfile({
      sex: 'male',
      indoorOutdoor: 'outdoor',
      altitude: 'sea-level',
      sunExposure: 'partial',
      windConditions: 'moderate',
      clothingType: 'light',
      sweatRate: 'medium',
      sweatSaltiness: 'medium',
      dailySaltIntake: 'medium',
      primaryGoal: 'performance',
      disciplines: [],
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

  if (showPlan && profile as HydrationProfile) {
    const plan = calculateHydrationPlan(profile as HydrationProfile);
    return (
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <HydrationPlanDisplay plan={plan} profile={profile as HydrationProfile} onReset={handleReset} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-6 pb-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header - Shows on all steps */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <img src={supplmeLogo} alt="SUPPLME" className="h-24 w-auto" />
          </div>
          {step === 0 && (
            <p className="text-lg text-muted-foreground">
              Your personalized hydration plan
            </p>
          )}
        </div>

        {/* Progress */}
        {step > 0 && <ProgressBar currentStep={step} totalSteps={6} />}

        {/* Validation Warnings */}
        {validationWarnings.length > 0 && step > 0 && (
          <div className="space-y-2">
            {validationWarnings.map((warning, index) => (
              <ValidationWarning key={index} message={warning} />
            ))}
          </div>
        )}

        {/* STEP 0: Welcome & Consent */}
        {step === 0 && (
          <QuestionnaireStep
            title="Welcome"
            description="Get a science-backed hydration plan tailored to your physiology, activity, and environment."
            onNext={() => setStep(1)}
            isValid={isStepValid()}
          >
            <div className="py-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-2xl font-bold mb-1">PRE</p>
                  <p className="text-sm text-muted-foreground">Preparation</p>
                </div>
                <div className="p-4 rounded-lg bg-primary text-primary-foreground">
                  <p className="text-2xl font-bold mb-1">DURING</p>
                  <p className="text-sm opacity-90">Performance</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-2xl font-bold mb-1">POST</p>
                  <p className="text-sm text-muted-foreground">Recovery</p>
                </div>
              </div>
              
              <div className="bg-muted/50 p-6 rounded-lg space-y-4">
                <h3 className="font-medium text-lg">Data Usage & AI Notice</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This tool uses artificial intelligence to generate personalized hydration recommendations based on peer-reviewed scientific research from PubMed.
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  By continuing, you agree to share your data anonymously with Supplme. This data will be used to develop and improve our products and recommendations.
                </p>
                
                <div className="flex items-start space-x-3 pt-4">
                  <Checkbox 
                    id="consent" 
                    checked={consentGiven}
                    onCheckedChange={(checked) => setConsentGiven(checked === true)}
                  />
                  <label
                    htmlFor="consent"
                    className="text-sm font-medium leading-relaxed cursor-pointer"
                  >
                    I agree to share my data anonymously with Supplme for product development and improvement
                  </label>
                </div>
              </div>
              
              <p className="text-center text-sm text-muted-foreground pt-2">
                Designed for endurance athletes: trail runners, triathletes, and ultra competitors
              </p>
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 1: Body & Physiology */}
        {step === 1 && (
          <QuestionnaireStep
            title="1. Body & Physiology"
            description="Basic information to calculate your hydration needs"
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="age">Age *</Label>
                  <Input
                    id="age"
                    type="number"
                    value={profile.age || ''}
                    onChange={(e) => updateProfile({ age: parseInt(e.target.value) })}
                    placeholder="Age"
                  />
                </div>
                <div>
                  <div className="flex items-center">
                    <Label htmlFor="weight">Weight (kg) *</Label>
                    <InfoTooltip content="Your body weight affects fluid requirements. Heavier athletes typically need more hydration." />
                  </div>
                  <Input
                    id="weight"
                    type="number"
                    value={profile.weight || ''}
                    onChange={(e) => updateProfile({ weight: parseInt(e.target.value) })}
                    placeholder="Weight"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="height">Height (cm) *</Label>
                <Input
                  id="height"
                  type="number"
                  value={profile.height || ''}
                  onChange={(e) => updateProfile({ height: parseInt(e.target.value) })}
                  placeholder="Height"
                />
              </div>

              <div>
                <Label>Sex *</Label>
                <RadioGroup
                  value={profile.sex || 'male'}
                  onValueChange={(value) => updateProfile({ sex: value as 'male' | 'female' | 'other' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="male" id="male" />
                    <Label htmlFor="male" className="font-normal">Male</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="female" id="female" />
                    <Label htmlFor="female" className="font-normal">Female</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="other" id="other" />
                    <Label htmlFor="other" className="font-normal">Other</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center">
                    <Label htmlFor="bodyFat">Body Fat %</Label>
                    <InfoTooltip content="Body fat percentage affects hydration needs - lower body fat means more body water. Can be measured with smart scales, DEXA scans, or found in Garmin Index, Apple Watch (requires third-party apps), or fitness assessments. Typical athletic range: 6-24% (men), 14-31% (women)." />
                  </div>
                  <Input
                    id="bodyFat"
                    type="number"
                    value={profile.bodyFat || ''}
                    onChange={(e) => updateProfile({ bodyFat: parseFloat(e.target.value) })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <div className="flex items-center">
                    <Label htmlFor="restingHeartRate">Resting HR</Label>
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
                  <Label htmlFor="hrv">HRV / Recovery Index</Label>
                  <InfoTooltip content="Heart Rate Variability measures recovery status. Found in fitness watches (Garmin, Apple Watch, Whoop). Low HRV = poor recovery, may need extra hydration. Normal range varies by individual - check your baseline." />
                </div>
                <Input
                  id="hrv"
                  value={profile.hrv || ''}
                  onChange={(e) => updateProfile({ hrv: e.target.value })}
                  placeholder="If tracked via Garmin/Whoop/Oura"
                />
              </div>

              <div>
                <Label htmlFor="healthConditions">Known Health Conditions</Label>
                <Input
                  id="healthConditions"
                  value={profile.healthConditions || ''}
                  onChange={(e) => updateProfile({ healthConditions: e.target.value })}
                  placeholder="e.g., hypertension, kidney issues"
                />
              </div>

              <div>
                <div className="flex items-center">
                  <Label htmlFor="sweatSodiumTest">Sweat Sodium Test (mmol/L)</Label>
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
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 2: Activity & Terrain */}
        {step === 2 && (
          <QuestionnaireStep
            title="2. Activity & Terrain"
            description="Tell us about your training and racing"
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label>Primary Discipline *</Label>
                <RadioGroup
                  value={profile.disciplines?.[0] || ''}
                  onValueChange={(value) => updateProfile({ disciplines: [value] })}
                >
                  {['Run', 'Swim', 'Bike', 'Triathlon'].map((disc) => (
                    <div key={disc} className="flex items-center space-x-2">
                      <RadioGroupItem value={disc} id={`disc-${disc}`} />
                      <Label htmlFor={`disc-${disc}`} className="font-normal">{disc}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="raceDistance">Typical Race Distance</Label>
                <Input
                  id="raceDistance"
                  value={profile.raceDistance || ''}
                  onChange={(e) => updateProfile({ raceDistance: e.target.value })}
                  placeholder="e.g., Ironman 70.3, Ultra 50K, Marathon"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center">
                    <Label htmlFor="sessionDuration">Session Duration (hours) *</Label>
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
                  <Label htmlFor="longestSession">Longest Session (hours)</Label>
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
              ) : profile.disciplines?.[0] === 'Swim' ? (
                <div>
                  <Label htmlFor="avgPace">Average Swim Pace</Label>
                  <Input
                    id="avgPace"
                    value={profile.avgPace || ''}
                    onChange={(e) => updateProfile({ avgPace: e.target.value })}
                    placeholder="e.g., 1:45/100m"
                  />
                </div>
              ) : profile.disciplines?.[0] === 'Bike' ? (
                <div>
                  <Label htmlFor="avgPace">Average Power/Speed</Label>
                  <Input
                    id="avgPace"
                    value={profile.avgPace || ''}
                    onChange={(e) => updateProfile({ avgPace: e.target.value })}
                    placeholder="e.g., 250W or 30 km/h"
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

              <div>
                <div className="flex items-center">
                  <Label htmlFor="elevationGain">Elevation Gain per Session (m)</Label>
                  <InfoTooltip content="Total uphill climbing during your activity. More climbing = higher energy demand and fluid loss. Check your GPS watch or route profile." />
                </div>
                <Input
                  id="elevationGain"
                  type="number"
                  value={profile.elevationGain || ''}
                  onChange={(e) => updateProfile({ elevationGain: parseInt(e.target.value) })}
                  placeholder="Meters"
                />
              </div>

              <div>
                <Label htmlFor="trainingFrequency">Training Frequency per Week</Label>
                <Input
                  id="trainingFrequency"
                  type="number"
                  value={profile.trainingFrequency || ''}
                  onChange={(e) => updateProfile({ trainingFrequency: parseInt(e.target.value) })}
                  placeholder="Sessions per week"
                />
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>Indoor or Outdoor *</Label>
                  <InfoTooltip content="Indoor environments typically have lower fluid loss due to controlled temperature and airflow." />
                </div>
                <RadioGroup
                  value={profile.indoorOutdoor || 'outdoor'}
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
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 3: Environment Data */}
        {step === 3 && (
          <QuestionnaireStep
            title="3. Environment Data"
            description="Training conditions affect your hydration needs"
            onNext={() => setStep(4)}
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
                    placeholder="Min"
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
                    placeholder="Max"
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
                  <Label htmlFor="humidity">Humidity Level (%) *</Label>
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
                  <Label>Altitude *</Label>
                  <InfoTooltip content="Sea-level: 0-1000m, Moderate: 1000-2500m, High: >2500m. Higher altitude increases respiratory fluid loss and dehydration risk." />
                </div>
                <RadioGroup
                  value={profile.altitude || 'sea-level'}
                  onValueChange={(value) => updateProfile({ altitude: value as 'sea-level' | 'moderate' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sea-level" id="sea-level" />
                    <Label htmlFor="sea-level" className="font-normal">Sea Level (0-1000m)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate" />
                    <Label htmlFor="moderate" className="font-normal">Moderate (1000-2500m)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high" className="font-normal">High (&gt;2500m)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>Sun Exposure *</Label>
                  <InfoTooltip content="Direct sun exposure increases body temperature and sweat rate significantly compared to shade." />
                </div>
                <RadioGroup
                  value={profile.sunExposure || 'partial'}
                  onValueChange={(value) => updateProfile({ sunExposure: value as 'shade' | 'partial' | 'full-sun' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="shade" id="shade" />
                    <Label htmlFor="shade" className="font-normal">Mostly Shade</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partial" id="partial" />
                    <Label htmlFor="partial" className="font-normal">Partial Sun</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full-sun" id="full-sun" />
                    <Label htmlFor="full-sun" className="font-normal">Full Sun</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Wind Conditions *</Label>
                <RadioGroup
                  value={profile.windConditions || 'moderate'}
                  onValueChange={(value) => updateProfile({ windConditions: value as 'calm' | 'moderate' | 'windy' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="calm" id="calm" />
                    <Label htmlFor="calm" className="font-normal">Calm</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate-wind" />
                    <Label htmlFor="moderate-wind" className="font-normal">Moderate</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="windy" id="windy" />
                    <Label htmlFor="windy" className="font-normal">Windy</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Clothing Type *</Label>
                <RadioGroup
                  value={profile.clothingType || 'light'}
                  onValueChange={(value) => updateProfile({ clothingType: value as 'minimal' | 'light' | 'moderate' | 'heavy' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="minimal" id="minimal" />
                    <Label htmlFor="minimal" className="font-normal">Minimal (singlet/shorts)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="font-normal">Light (typical running gear)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate-cloth" />
                    <Label htmlFor="moderate-cloth" className="font-normal">Moderate (long sleeves)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="heavy" id="heavy" />
                    <Label htmlFor="heavy" className="font-normal">Heavy (jacket/layers)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 4: Sweat Profile */}
        {step === 4 && (
          <QuestionnaireStep
            title="4. Sweat Profile"
            description="Understanding your sweat rate and saltiness helps optimize electrolyte intake"
            onNext={() => setStep(5)}
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
                  <Label>Sweat Rate *</Label>
                  <InfoTooltip content="Your sweat rate affects hydration needs. If you're unsure, choose 'medium'. High sweat rate = clothing soaked during exercise. Low = minimal sweating even during hard efforts." />
                </div>
                <RadioGroup
                  value={profile.sweatRate || 'medium'}
                  onValueChange={(value) => updateProfile({ sweatRate: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="sweat-low" />
                    <Label htmlFor="sweat-low" className="font-normal">Low (minimal sweating)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="sweat-medium" />
                    <Label htmlFor="sweat-medium" className="font-normal">Medium (moderate sweating)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="sweat-high" />
                    <Label htmlFor="sweat-high" className="font-normal">High (heavy sweating)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>Sweat Saltiness *</Label>
                  <InfoTooltip content="Salty sweat = white residue on skin/clothing after exercise. This indicates higher sodium loss. Can be measured with a sweat sodium test at sports labs or with at-home kits." />
                </div>
                <RadioGroup
                  value={profile.sweatSaltiness || 'medium'}
                  onValueChange={(value) => updateProfile({ sweatSaltiness: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="salt-low" />
                    <Label htmlFor="salt-low" className="font-normal">Low (no white residue)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="salt-medium" />
                    <Label htmlFor="salt-medium" className="font-normal">Medium (some residue)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="salt-high" />
                    <Label htmlFor="salt-high" className="font-normal">High (significant white residue)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <div className="flex items-center mb-2">
                  <Label>Cramping During Exercise</Label>
                  <InfoTooltip content="Exercise-associated muscle cramps often indicate electrolyte imbalance, particularly sodium and magnesium deficiency." />
                </div>
                <RadioGroup
                  value={profile.crampTiming || 'none'}
                  onValueChange={(value) => updateProfile({ crampTiming: value as 'none' | 'early' | 'mid' | 'late' | 'post' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="cramp-none" />
                    <Label htmlFor="cramp-none" className="font-normal">None</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="early" id="cramp-early" />
                    <Label htmlFor="cramp-early" className="font-normal">Early in activity</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mid" id="cramp-mid" />
                    <Label htmlFor="cramp-mid" className="font-normal">Mid-activity</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="late" id="cramp-late" />
                    <Label htmlFor="cramp-late" className="font-normal">Late in activity</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="post" id="cramp-post" />
                    <Label htmlFor="cramp-post" className="font-normal">Post-activity</Label>
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
        {step === 5 && (
          <QuestionnaireStep
            title="5. Dietary Habits"
            description="Your everyday nutrition affects hydration needs"
            onNext={() => setStep(6)}
            onBack={() => setStep(4)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <div className="flex items-center mb-2">
                  <Label>Daily Salt Intake *</Label>
                  <InfoTooltip content="Low: minimal processed foods, no added salt. Medium: normal diet with some salt. High: salty foods regularly, add salt to meals." />
                </div>
                <RadioGroup
                  value={profile.dailySaltIntake || 'medium'}
                  onValueChange={(value) => updateProfile({ dailySaltIntake: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="salt-intake-low" />
                    <Label htmlFor="salt-intake-low" className="font-normal">Low (little added salt)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="salt-intake-medium" />
                    <Label htmlFor="salt-intake-medium" className="font-normal">Medium (moderate salt)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="salt-intake-high" />
                    <Label htmlFor="salt-intake-high" className="font-normal">High (regular salt use)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="dailyWaterIntake">Daily Water Intake (liters)</Label>
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
                  <Label htmlFor="caffeineIntake">Daily Caffeine Intake (mg)</Label>
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
                <Label htmlFor="dietType">Diet Type</Label>
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
        {step === 6 && (
          <QuestionnaireStep
            title="6. Goals & Events"
            description="Help us tailor your plan to your objectives"
            onNext={handleComplete}
            onBack={() => setStep(5)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label>Primary Goal *</Label>
                <RadioGroup
                  value={profile.primaryGoal || 'performance'}
                  onValueChange={(value) => updateProfile({ primaryGoal: value as 'performance' | 'health' | 'weight-loss' | 'endurance' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="performance" id="goal-performance" />
                    <Label htmlFor="goal-performance" className="font-normal">Performance Optimization</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="health" id="goal-health" />
                    <Label htmlFor="goal-health" className="font-normal">Health & Wellness</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weight-loss" id="goal-weight" />
                    <Label htmlFor="goal-weight" className="font-normal">Weight Management</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="endurance" id="goal-endurance" />
                    <Label htmlFor="goal-endurance" className="font-normal">Endurance Building</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="upcomingEvents">Upcoming Events</Label>
                <Textarea
                  id="upcomingEvents"
                  value={profile.upcomingEvents || ''}
                  onChange={(e) => updateProfile({ upcomingEvents: e.target.value })}
                  placeholder="List any races or events you're training for"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="specificConcerns">Specific Hydration Concerns</Label>
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
