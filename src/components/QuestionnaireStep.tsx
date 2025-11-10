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
    <Card className="athletic-card p-8 space-y-6 border-border/50 backdrop-blur-sm">
      <div className="space-y-3">
        <h2 className="text-3xl font-bold tracking-tight chrome-shine uppercase">
          {title}
        </h2>
        {description && (
          <p className="text-muted-foreground text-base leading-relaxed">
            {description}
          </p>
        )}
      </div>

      <div className="space-y-6 py-2">{children}</div>

      <div className="flex gap-3 pt-6 border-t border-border/30">
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            className="flex-1 h-12 text-base font-semibold border-chrome/30 hover:border-chrome hover:bg-muted/50 transition-all duration-300"
          >
            {t('common.back')}
          </Button>
        )}
        <Button
          onClick={onNext}
          disabled={!isValid}
          className="flex-1 h-12 text-base font-bold bg-gradient-to-r from-primary to-primary-glow hover:shadow-lg hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {nextButtonText || t('common.next')}
        </Button>
      </div>
    </Card>
  );
}
