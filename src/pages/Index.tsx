import { useState } from 'react';
import { HydrationProfile } from '@/types/hydration';
import { calculateHydrationPlan } from '@/utils/hydrationCalculator';
import { ProgressBar } from '@/components/ProgressBar';
import { QuestionnaireStep } from '@/components/QuestionnaireStep';
import { HydrationPlanDisplay } from '@/components/HydrationPlanDisplay';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Droplets } from 'lucide-react';

const Index = () => {
  const [step, setStep] = useState(0);
  const [showPlan, setShowPlan] = useState(false);
  const [profile, setProfile] = useState<Partial<HydrationProfile>>({
    sex: 'male',
    activityType: 'running',
    intensity: 'moderate',
    humidity: 'medium',
    sweatRate: 'medium',
    sweatSaltiness: 'medium',
    goal: 'performance',
  });

  const updateProfile = (updates: Partial<HydrationProfile>) => {
    setProfile({ ...profile, ...updates });
  };

  const isStepValid = (): boolean => {
    switch (step) {
      case 0:
        return true; // Welcome step
      case 1:
        return !!(profile.age && profile.sex && profile.weight);
      case 2:
        return !!(profile.activityType && profile.duration && profile.intensity);
      case 3:
        return !!(profile.temperature !== undefined && profile.humidity);
      case 4:
        return !!(profile.sweatRate && profile.sweatSaltiness);
      case 5:
        return !!profile.goal;
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
      activityType: 'running',
      intensity: 'moderate',
      humidity: 'medium',
      sweatRate: 'medium',
      sweatSaltiness: 'medium',
      goal: 'performance',
    });
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
            Personalized Hydration Plan Generator
          </p>
        </div>

        {/* Progress */}
        {step > 0 && <ProgressBar currentStep={step} totalSteps={5} />}

        {/* Steps */}
        {step === 0 && (
          <QuestionnaireStep
            title="Master Your Hydration Strategy"
            description="Get a science-backed hydration plan tailored to your activity, environment, and physiology. Takes less than 2 minutes."
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
                Used by elite athletes to maximize performance and recovery
              </p>
            </div>
          </QuestionnaireStep>
        )}

        {step === 1 && (
          <QuestionnaireStep
            title="Body & Physiology"
            description="Basic information to calculate your hydration needs"
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={profile.age || ''}
                  onChange={(e) => updateProfile({ age: parseInt(e.target.value) })}
                  placeholder="Enter your age"
                />
              </div>

              <div>
                <Label>Sex</Label>
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

              <div>
                <Label htmlFor="weight">Weight (kg)</Label>
                <Input
                  id="weight"
                  type="number"
                  value={profile.weight || ''}
                  onChange={(e) => updateProfile({ weight: parseInt(e.target.value) })}
                  placeholder="Enter your weight"
                />
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {step === 2 && (
          <QuestionnaireStep
            title="Activity Details"
            description="Tell us about your typical training session"
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label>Activity Type</Label>
                <RadioGroup
                  value={profile.activityType || 'running'}
                  onValueChange={(value) => updateProfile({ activityType: value as HydrationProfile['activityType'] })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="running" id="running" />
                    <Label htmlFor="running" className="font-normal">Running</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="cycling" id="cycling" />
                    <Label htmlFor="cycling" className="font-normal">Cycling</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="trail" id="trail" />
                    <Label htmlFor="trail" className="font-normal">Trail Running</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="triathlon" id="triathlon" />
                    <Label htmlFor="triathlon" className="font-normal">Triathlon</Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="duration">Duration (hours)</Label>
                <Input
                  id="duration"
                  type="number"
                  step="0.5"
                  value={profile.duration || ''}
                  onChange={(e) => updateProfile({ duration: parseFloat(e.target.value) })}
                  placeholder="Typical session length"
                />
              </div>

              <div>
                <Label>Intensity</Label>
                <RadioGroup
                  value={profile.intensity || 'moderate'}
                  onValueChange={(value) => updateProfile({ intensity: value as 'low' | 'moderate' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="low" />
                    <Label htmlFor="low" className="font-normal">Low (Easy pace, conversational)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="moderate" id="moderate" />
                    <Label htmlFor="moderate" className="font-normal">Moderate (Steady effort)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="high" />
                    <Label htmlFor="high" className="font-normal">High (Race pace, intervals)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {step === 3 && (
          <QuestionnaireStep
            title="Environment"
            description="Training conditions affect your hydration needs"
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="temperature">Temperature (°C)</Label>
                <Input
                  id="temperature"
                  type="number"
                  value={profile.temperature || ''}
                  onChange={(e) => updateProfile({ temperature: parseInt(e.target.value) })}
                  placeholder="Typical training temperature"
                />
              </div>

              <div>
                <Label>Humidity</Label>
                <RadioGroup
                  value={profile.humidity || 'medium'}
                  onValueChange={(value) => updateProfile({ humidity: value as 'low' | 'medium' | 'high' })}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low" id="humidity-low" />
                    <Label htmlFor="humidity-low" className="font-normal">Low (Dry conditions)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="medium" id="humidity-medium" />
                    <Label htmlFor="humidity-medium" className="font-normal">Medium (Moderate humidity)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="high" id="humidity-high" />
                    <Label htmlFor="humidity-high" className="font-normal">High (Very humid)</Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
          </QuestionnaireStep>
        )}

        {step === 4 && (
          <QuestionnaireStep
            title="Sweat Profile"
            description="Understanding your sweat helps optimize electrolyte replacement"
            onNext={() => setStep(5)}
            onBack={() => setStep(3)}
            isValid={isStepValid()}
          >
            <div className="space-y-4">
              <div>
                <Label>Sweat Rate</Label>
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
                <Label>Sweat Saltiness</Label>
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
            </div>
          </QuestionnaireStep>
        )}

        {step === 5 && (
          <QuestionnaireStep
            title="Your Goal"
            description="What's your primary training objective?"
            onNext={handleComplete}
            onBack={() => setStep(4)}
            isValid={isStepValid()}
          >
            <RadioGroup
              value={profile.goal || 'performance'}
              onValueChange={(value) => updateProfile({ goal: value as 'performance' | 'endurance' | 'recovery' })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="performance" id="performance" />
                <Label htmlFor="performance" className="font-normal">Performance (Maximize race-day results)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="endurance" id="endurance" />
                <Label htmlFor="endurance" className="font-normal">Endurance (Long training sessions)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="recovery" id="recovery" />
                <Label htmlFor="recovery" className="font-normal">Recovery (Optimize adaptation)</Label>
              </div>
            </RadioGroup>
          </QuestionnaireStep>
        )}
      </div>
    </div>
  );
};

export default Index;
