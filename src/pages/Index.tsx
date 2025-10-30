import { useState } from 'react';
import { HydrationProfile } from '@/types/hydration';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import { HydrationPlanDisplay } from '@/components/HydrationPlanDisplay';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Droplets } from 'lucide-react';

const Index = () => {
  const [step, setStep] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
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
    setProfile({ ...profile, ...updates });
  };

  const isStepValid = (): boolean => {
    switch (step) {
      case 0:
        return true; // Welcome
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
          <HydrationPlanDisplay plan={plan} onReset={handleReset} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Droplets className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">SUPPLME</h1>
          <p className="text-xl text-muted-foreground">
            Endurance & Trail Hydration Profile
          </p>
        </div>

        {/* Progress */}
        {step > 0 && <ProgressBar currentStep={step} totalSteps={6} />}

        {/* STEP 0: Welcome */}
        {step === 0 && (
          <QuestionnaireStep
            title="Master Your Hydration Strategy"
            description="Get a science-backed hydration plan tailored to your physiology, activity, and environment."
            onNext={() => setStep(1)}
            isValid={true}
          >
            <div className="py-6 space-y-4">
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
              <p className="text-center text-sm text-muted-foreground pt-4">
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
                  <Label htmlFor="weight">Weight (kg) *</Label>
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
                  <Label htmlFor="bodyFat">Body Fat %</Label>
                  <Input
                    id="bodyFat"
                    type="number"
                    value={profile.bodyFat || ''}
                    onChange={(e) => updateProfile({ bodyFat: parseFloat(e.target.value) })}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <Label htmlFor="restingHeartRate">Resting HR</Label>
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
                <Label htmlFor="hrv">HRV / Recovery Index</Label>
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
                <Label htmlFor="sweatSodiumTest">Sweat Sodium Test (mmol/L)</Label>
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
                <Label>Disciplines (select all that apply) *</Label>
                <div className="space-y-2 mt-2">
                  {['Swim', 'Bike', 'Run', 'Trail', 'Other'].map((disc) => (
                    <div key={disc} className="flex items-center space-x-2">
                      <Checkbox
                        id={disc}
                        checked={profile.disciplines?.includes(disc)}
                        onCheckedChange={() => toggleDiscipline(disc)}
                      />
                      <Label htmlFor={disc} className="font-normal">{disc}</Label>
                    </div>
                  ))}
                </div>
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
                  <Label htmlFor="sessionDuration">Session Duration (hours) *</Label>
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

              <div>
                <Label htmlFor="avgPace">Average Pace or Power Output</Label>
                <Input
                  id="avgPace"
                  value={profile.avgPace || ''}
                  onChange={(e) => updateProfile({ avgPace: e.target.value })}
                  placeholder="e.g., 5:30/km, 250W"
                />
              </div>

              <div>
                <Label htmlFor="elevationGain">Elevation Gain per Session (m)</Label>
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
                <Label>Indoor or Outdoor *</Label>
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
                <Label htmlFor="humidity">Humidity Level (%) *</Label>
                <Input
                  id="humidity"
                  type="number"
                  value={profile.humidity || ''}
                  onChange={(e) => updateProfile({ humidity: parseInt(e.target.value) })}
                  placeholder="Average humidity"
                />
              </div>

              <div>
                <Label>Altitude *</Label>
                <RadioGroup
                  value={profile.altitude || 'sea-level'}
                  onValueChange={(value) => updateProfile({ altitude: value as 'sea-level' | 'moderate' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sea-level" id="sea-level" />
                    <Label htmlFor="sea-level" className="font-normal">Sea Level (0-500m)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate" />
                    <Label htmlFor="moderate" className="font-normal">Moderate (500-1500m)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high" className="font-normal">High (1500m+)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Sun Exposure *</Label>
                <RadioGroup
                  value={profile.sunExposure || 'partial'}
                  onValueChange={(value) => updateProfile({ sunExposure: value as 'shade' | 'partial' | 'full-sun' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="shade" id="shade" />
                    <Label htmlFor="shade" className="font-normal">Shade</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partial" id="partial" />
                    <Label htmlFor="partial" className="font-normal">Partial</Label>
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
                  onValueChange={(value) => updateProfile({ clothingType: value as 'light' | 'compression' | 'layers' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="light" id="light" />
                    <Label htmlFor="light" className="font-normal">Light</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="compression" id="compression" />
                    <Label htmlFor="compression" className="font-normal">Compression</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="layers" id="layers" />
                    <Label htmlFor="layers" className="font-normal">Layers</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="climate">Season or Climate</Label>
                <Input
                  id="climate"
                  value={profile.climate || ''}
                  onChange={(e) => updateProfile({ climate: e.target.value })}
                  placeholder="e.g., Nordic winter, Mediterranean summer"
                />
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 4: Hydration & Sweat Data */}
        {step === 4 && (
          <QuestionnaireStep
            title="4. Hydration & Sweat Data"
            description="Understanding your sweat helps optimize electrolyte replacement"
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label>Sweat Rate *</Label>
                <RadioGroup
                  value={profile.sweatRate || 'medium'}
                  onValueChange={(value) => updateProfile({ sweatRate: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="sweat-low" />
                    <Label htmlFor="sweat-low" className="font-normal">Low (Minimal sweating)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="sweat-medium" />
                    <Label htmlFor="sweat-medium" className="font-normal">Medium (Moderate sweating)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="sweat-high" />
                    <Label htmlFor="sweat-high" className="font-normal">High (Heavy sweating)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Sweat Saltiness *</Label>
                <RadioGroup
                  value={profile.sweatSaltiness || 'medium'}
                  onValueChange={(value) => updateProfile({ sweatSaltiness: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="salt-low" />
                    <Label htmlFor="salt-low" className="font-normal">Low (No visible salt residue)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="salt-medium" />
                    <Label htmlFor="salt-medium" className="font-normal">Medium (Some salt stains)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="salt-high" />
                    <Label htmlFor="salt-high" className="font-normal">High (Heavy salt crusting)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="fluidIntake">Fluid Intake During Sessions (ml/hour)</Label>
                <Input
                  id="fluidIntake"
                  type="number"
                  value={profile.fluidIntake || ''}
                  onChange={(e) => updateProfile({ fluidIntake: parseInt(e.target.value) })}
                  placeholder="Estimated or measured"
                />
              </div>

              <div>
                <Label htmlFor="urineColor">Urine Color (1-8 scale)</Label>
                <Input
                  id="urineColor"
                  type="number"
                  min="1"
                  max="8"
                  value={profile.urineColor || ''}
                  onChange={(e) => updateProfile({ urineColor: parseInt(e.target.value) })}
                  placeholder="1=clear, 8=dark"
                />
              </div>

              <div>
                <Label>Cramp Timing</Label>
                <RadioGroup
                  value={profile.crampTiming || 'none'}
                  onValueChange={(value) => updateProfile({ crampTiming: value as 'during' | 'after' | 'night' | 'none' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="cramp-none" />
                    <Label htmlFor="cramp-none" className="font-normal">No cramping</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="during" id="cramp-during" />
                    <Label htmlFor="cramp-during" className="font-normal">During activity</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="after" id="cramp-after" />
                    <Label htmlFor="cramp-after" className="font-normal">After activity</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="night" id="cramp-night" />
                    <Label htmlFor="cramp-night" className="font-normal">At night</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="dehydrationSymptoms">Common Dehydration Symptoms</Label>
                <Textarea
                  id="dehydrationSymptoms"
                  value={profile.dehydrationSymptoms?.join(', ') || ''}
                  onChange={(e) => updateProfile({ dehydrationSymptoms: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="e.g., cramps, headaches, dizziness"
                />
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 5: Nutrition & Fueling */}
        {step === 5 && (
          <QuestionnaireStep
            title="5. Nutrition & Fueling"
            description="Your nutrition strategy impacts hydration needs"
            onNext={() => setStep(6)}
            onBack={() => setStep(4)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="fuelingStrategy">Fueling Strategy During Training/Races</Label>
                <Input
                  id="fuelingStrategy"
                  value={profile.fuelingStrategy || ''}
                  onChange={(e) => updateProfile({ fuelingStrategy: e.target.value })}
                  placeholder="e.g., 60g carbs/hr, gels + bars"
                />
              </div>

              <div>
                <Label htmlFor="preMealTiming">Pre-Event Meal Timing (hours before)</Label>
                <Input
                  id="preMealTiming"
                  type="number"
                  step="0.5"
                  value={profile.preMealTiming || ''}
                  onChange={(e) => updateProfile({ preMealTiming: parseFloat(e.target.value) })}
                  placeholder="Hours"
                />
              </div>

              <div>
                <Label htmlFor="recoveryWindow">Recovery Nutrition Window (minutes)</Label>
                <Input
                  id="recoveryWindow"
                  type="number"
                  value={profile.recoveryWindow || ''}
                  onChange={(e) => updateProfile({ recoveryWindow: parseInt(e.target.value) })}
                  placeholder="Minutes post-activity"
                />
              </div>

              <div>
                <Label>Caffeine Strategy</Label>
                <RadioGroup
                  value={profile.caffeineStrategy || 'none'}
                  onValueChange={(value) => updateProfile({ caffeineStrategy: value as 'pre' | 'mid' | 'post' | 'none' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="caff-none" />
                    <Label htmlFor="caff-none" className="font-normal">None</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pre" id="caff-pre" />
                    <Label htmlFor="caff-pre" className="font-normal">Pre-activity</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="mid" id="caff-mid" />
                    <Label htmlFor="caff-mid" className="font-normal">Mid-activity</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="post" id="caff-post" />
                    <Label htmlFor="caff-post" className="font-normal">Post-activity</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label>Daily Salt Intake *</Label>
                <RadioGroup
                  value={profile.dailySaltIntake || 'medium'}
                  onValueChange={(value) => updateProfile({ dailySaltIntake: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="salt-intake-low" />
                    <Label htmlFor="salt-intake-low" className="font-normal">Low (avoid added salt)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="salt-intake-medium" />
                    <Label htmlFor="salt-intake-medium" className="font-normal">Medium (normal diet)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="salt-intake-high" />
                    <Label htmlFor="salt-intake-high" className="font-normal">High (salt foods regularly)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="otherSupplements">Other Supplements Used</Label>
                <Input
                  id="otherSupplements"
                  value={profile.otherSupplements || ''}
                  onChange={(e) => updateProfile({ otherSupplements: e.target.value })}
                  placeholder="e.g., vitamins, BCAAs"
                />
              </div>

              <div>
                <Label htmlFor="specialDiet">Special Diets</Label>
                <Input
                  id="specialDiet"
                  value={profile.specialDiet || ''}
                  onChange={(e) => updateProfile({ specialDiet: e.target.value })}
                  placeholder="e.g., low-carb, plant-based"
                />
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {/* STEP 6: Goals & Performance + Optional Data */}
        {step === 6 && (
          <QuestionnaireStep
            title="6. Goals & Performance"
            description="Your objectives and additional information"
            onNext={handleComplete}
            onBack={() => setStep(5)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label>Primary Goal *</Label>
                <RadioGroup
                  value={profile.primaryGoal || 'performance'}
                  onValueChange={(value) => updateProfile({ primaryGoal: value as 'performance' | 'recovery' | 'daily-hydration' | 'completion' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="performance" id="goal-performance" />
                    <Label htmlFor="goal-performance" className="font-normal">Performance (maximize results)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="completion" id="goal-completion" />
                    <Label htmlFor="goal-completion" className="font-normal">Completion (finish strong)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="recovery" id="goal-recovery" />
                    <Label htmlFor="goal-recovery" className="font-normal">Recovery (optimize adaptation)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="daily-hydration" id="goal-daily" />
                    <Label htmlFor="goal-daily" className="font-normal">Daily Hydration</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="targetEvents">Target Events or Upcoming Races</Label>
                <Input
                  id="targetEvents"
                  value={profile.targetEvents || ''}
                  onChange={(e) => updateProfile({ targetEvents: e.target.value })}
                  placeholder="Event name and date"
                />
              </div>

              <div>
                <Label htmlFor="performanceGoal">Performance Goal</Label>
                <Input
                  id="performanceGoal"
                  value={profile.performanceGoal || ''}
                  onChange={(e) => updateProfile({ performanceGoal: e.target.value })}
                  placeholder="e.g., sub-3 hour, top 10 placement"
                />
              </div>

              <div>
                <Label htmlFor="pastIssues">Past Hydration or Cramping Issues</Label>
                <Textarea
                  id="pastIssues"
                  value={profile.pastIssues || ''}
                  onChange={(e) => updateProfile({ pastIssues: e.target.value })}
                  placeholder="Describe any issues from past events"
                />
              </div>

              <div className="pt-6 border-t">
                <p className="text-sm font-semibold mb-3">Optional Data</p>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="weeklyVolume">Weekly Training Volume (hrs/week)</Label>
                    <Input
                      id="weeklyVolume"
                      type="number"
                      value={profile.weeklyVolume || ''}
                      onChange={(e) => updateProfile({ weeklyVolume: parseFloat(e.target.value) })}
                      placeholder="Hours"
                    />
                  </div>

                  <div>
                    <Label htmlFor="sleepQuality">Average Sleep Quality (1-10)</Label>
                    <Input
                      id="sleepQuality"
                      type="number"
                      min="1"
                      max="10"
                      value={profile.sleepQuality || ''}
                      onChange={(e) => updateProfile({ sleepQuality: parseInt(e.target.value) })}
                      placeholder="1=poor, 10=excellent"
                    />
                  </div>

                  <div>
                    <Label htmlFor="otherNotes">Other Notes</Label>
                    <Textarea
                      id="otherNotes"
                      value={profile.otherNotes || ''}
                      onChange={(e) => updateProfile({ otherNotes: e.target.value })}
                      placeholder="Any additional information"
                    />
                  </div>
                </div>
              </div>
            </div>
          </QuestionnaireStep>
        )}
      </div>
    </div>
  );
};

export default Index;
