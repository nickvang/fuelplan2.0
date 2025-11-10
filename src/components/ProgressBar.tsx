import { Check } from 'lucide-react';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100;
  const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* Step indicators */}
      <div className="flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-muted/30 -translate-y-1/2 -z-10" />
        <div 
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-primary via-primary-glow to-primary -translate-y-1/2 -z-10 transition-all duration-700 ease-out"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />
        
        {steps.map((step) => {
          const isCompleted = step < currentStep;
          const isCurrent = step === currentStep;
          
          return (
            <div
              key={step}
              className={`
                relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-500
                ${isCompleted 
                  ? 'bg-primary border-primary text-primary-foreground scale-100' 
                  : isCurrent 
                    ? 'bg-background border-primary text-primary scale-110 shadow-lg shadow-primary/20 animate-pulse' 
                    : 'bg-background border-muted text-muted-foreground scale-90'
                }
              `}
            >
              {isCompleted ? (
                <Check className="w-5 h-5 animate-scale-in" />
              ) : (
                <span className={`text-sm font-bold ${isCurrent ? 'chrome-shine' : ''}`}>
                  {step}
                </span>
              )}
              
              {/* Glow effect for current step */}
              {isCurrent && (
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="chrome-shine text-lg font-black tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="h-3 w-full bg-muted/20 rounded-full overflow-hidden border border-border/30 relative shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-primary via-primary-glow to-primary shimmer transition-all duration-700 ease-out relative group"
            style={{ width: `${progress}%` }}
          >
            {/* Gloss effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/10" />
            {/* Animated shine */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
          </div>
        </div>
      </div>
    </div>
  );
}
