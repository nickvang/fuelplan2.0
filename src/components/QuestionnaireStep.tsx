import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface QuestionnaireStepProps {
  title: string;
  description?: string;
  children: ReactNode;
  onNext: () => void;
  onBack?: () => void;
  isValid: boolean;
}

export function QuestionnaireStep({
  title,
  description,
  children,
  onNext,
  onBack,
  isValid,
}: QuestionnaireStepProps) {
  return (
    <Card className="p-8 space-y-6 border-border">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="space-y-6">{children}</div>

      <div className="flex gap-3 pt-4">
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            className="flex-1"
          >
            Back
          </Button>
        )}
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1"
        >
          {onBack ? 'Continue' : 'Get Started'}
        </Button>
      </div>
    </Card>
  );
}
