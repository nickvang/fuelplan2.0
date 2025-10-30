import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';

interface QuestionnaireStepProps {
  title: string;
  description?: string;
  children: ReactNode;
  onNext: () => void;
  onBack?: () => void;
  isValid: boolean;
  nextButtonText?: string;
}

export function QuestionnaireStep({
  title,
  description,
  children,
  onNext,
  onBack,
  isValid,
  nextButtonText,
}: QuestionnaireStepProps) {
  const { t } = useLanguage();
  
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
            {t('common.back')}
          </Button>
        )}
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1"
        >
          {nextButtonText || t('common.next')}
        </Button>
      </div>
    </Card>
  );
}
