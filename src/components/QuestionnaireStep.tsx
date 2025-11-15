import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import supplmeLogo from '@/assets/supplme-logo.png';

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
    <Card className="athletic-card p-8 md:p-10 space-y-8 border-border/50 backdrop-blur-sm animate-fade-in relative overflow-hidden group">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="space-y-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="h-1 w-12 bg-gradient-to-r from-primary to-chrome rounded-full shimmer" />
        </div>
        <div className="flex items-center gap-4">
          <img src={supplmeLogo} alt="Supplme" className="h-12 md:h-14" />
          <h2 className="text-3xl md:text-4xl font-black tracking-tight chrome-shine uppercase">
            {title}
          </h2>
        </div>
        {description && (
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </div>

      <div className="space-y-6 py-4 relative z-10 animate-scale-in">
        {children}
      </div>

      <div className="flex gap-4 pt-8 border-t border-border/30 relative z-10">
        {onBack && (
          <Button
            onClick={onBack}
            variant="outline"
            size="lg"
            className="group/btn flex items-center gap-2 flex-1 h-14 text-base font-semibold border-2 border-border/50 hover:border-primary/50 hover:bg-muted/50 transition-all duration-300 hover:scale-[1.02]"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover/btn:-translate-x-1" />
            {t('common.back')}
          </Button>
        )}
        <Button
          onClick={onNext}
          disabled={!isValid}
          size="lg"
          className="group/btn flex items-center justify-center gap-2 flex-1 h-14 text-base font-bold bg-gradient-to-r from-primary via-primary-glow to-primary hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none relative overflow-hidden"
        >
          <span className="relative z-10">{nextButtonText || t('common.next')}</span>
          <ArrowRight className="w-5 h-5 relative z-10 transition-transform group-hover/btn:translate-x-1" />
          {/* Animated shimmer effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover/btn:translate-x-[200%] transition-transform duration-1000" />
        </Button>
      </div>
    </Card>
  );
}
