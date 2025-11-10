interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const progress = (currentStep / totalSteps) * 100;

  return (
    <div className="w-full space-y-3">
      <div className="flex justify-between items-center text-sm font-semibold">
        <span className="text-foreground/80 uppercase tracking-wider text-xs">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="chrome-shine text-base font-bold">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden border border-border/20 relative">
        <div
          className="h-full bg-gradient-to-r from-primary via-primary-glow to-primary shimmer transition-all duration-500 ease-out relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-white/10" />
        </div>
      </div>
    </div>
  );
}
