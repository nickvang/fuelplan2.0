import { HydrationPlan, HydrationProfile } from '@/types/hydration';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Droplets, TrendingUp, Activity, Zap, Award, Shield } from 'lucide-react';
import supplmeLogo from '@/assets/supplme-logo-sort.svg';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  plan: HydrationPlan;
  profile: HydrationProfile;
  hasSmartWatchData?: boolean;
}

export function HydrationPlanDisplayPremium({ plan, profile, hasSmartWatchData }: Props) {
  const { t } = useLanguage();
  const isRaceDay = profile.raceDistance && profile.raceDistance.length > 0;
  
  return (
    <div className="max-w-5xl mx-auto space-y-8 sm:space-y-12 py-6 sm:py-8 px-4 sm:px-0">
      {/* Premium Header */}
      <div className="text-center space-y-4 sm:space-y-6">
        <img src={supplmeLogo} alt="SUPPLME" className="h-14 sm:h-20 mx-auto" />
        {hasSmartWatchData && (
          <Badge className="bg-primary text-primary-foreground text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 font-bold">
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            AI + SMARTWATCH VERIFIED
          </Badge>
        )}
        <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight">{t('result.precisionHydrationPlan')}</h1>
        <p className="text-muted-foreground text-base sm:text-lg">Scientific. Personal. Performance-Driven.</p>
      </div>

      {/* Fluid Loss - Hero Number */}
      <Card className="bg-gradient-athletic border-0 shadow-bold overflow-hidden">
        <div className="p-6 sm:p-12 text-center relative">
          <div className="absolute inset-0 bg-gradient-glow opacity-50" />
          <div className="relative z-10">
            <Droplets className="w-10 h-10 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 text-accent" />
            <p className="text-xs font-bold text-accent uppercase tracking-widest mb-2 sm:mb-3">TOTAL FLUID LOSS</p>
            <p className="text-6xl sm:text-8xl font-black text-primary-foreground mb-1 sm:mb-2">{plan.totalFluidLoss.toLocaleString()}</p>
            <p className="text-2xl sm:text-4xl font-bold text-accent">ml</p>
          </div>
        </div>
      </Card>

      {/* 3-Phase Protocol */}
      <div className="space-y-5 sm:space-y-8">
        <div className="text-center">
          <h2 className="text-2xl sm:text-4xl font-black uppercase mb-2">{t('result.performanceProtocol')}</h2>
          <p className="text-muted-foreground text-sm sm:text-base">PRE / DURING / POST</p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
          {/* PRE */}
          <Card className="border-2 border-border hover:border-primary transition-all">
            <div className="p-5 sm:p-8 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-2xl font-black uppercase">PRE</h3>
                <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">WATER</p>
                  <p className="text-4xl sm:text-5xl font-black text-foreground">{plan.preActivity.water}</p>
                  <p className="text-sm font-bold text-muted-foreground">ml</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">SACHETS</p>
                  <p className="text-4xl sm:text-5xl font-black text-foreground">{plan.preActivity.electrolytes}</p>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">{plan.preActivity.timing}</p>
              </div>
            </div>
          </Card>

          {/* DURING */}
          <Card className="border-2 border-primary bg-gradient-glow shadow-bold">
            <div className="p-5 sm:p-8 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-2xl font-black uppercase">DURING</h3>
                <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">WATER / HOUR</p>
                  <p className="text-4xl sm:text-5xl font-black text-foreground">{plan.duringActivity.waterPerHour}</p>
                  <p className="text-sm font-bold text-muted-foreground">ml/h</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">SACHETS / HOUR</p>
                  <p className="text-4xl sm:text-5xl font-black text-foreground">{plan.duringActivity.electrolytesPerHour}</p>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">{plan.duringActivity.frequency}</p>
              </div>
            </div>
          </Card>

          {/* POST */}
          <Card className="border-2 border-border hover:border-primary transition-all">
            <div className="p-5 sm:p-8 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-2xl font-black uppercase">POST</h3>
                <Award className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
              </div>
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">WATER</p>
                  <p className="text-4xl sm:text-5xl font-black text-foreground">{plan.postActivity.water}</p>
                  <p className="text-sm font-bold text-muted-foreground">ml</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">SACHETS</p>
                  <p className="text-4xl sm:text-5xl font-black text-foreground">{plan.postActivity.electrolytes}</p>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">{plan.postActivity.timing}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Key Insights */}
      <Card className="bg-muted/30 border-0">
        <div className="p-5 sm:p-8 space-y-4">
          <h3 className="text-xl sm:text-2xl font-black uppercase mb-3 sm:mb-4">{t('result.keyInsights')}</h3>
          {plan.recommendations.map((rec, i) => (
            <div key={i} className="flex gap-3 items-start">
              <TrendingUp className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground leading-relaxed">{rec}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Training vs Race Day Explanation */}
      <Card className="bg-gradient-athletic border-0 shadow-bold">
        <div className="p-5 sm:p-8 space-y-4 text-primary-foreground">
          <h3 className="text-xl sm:text-2xl font-black uppercase">{t('result.trainingVsRaceDay')}</h3>
          <div className="space-y-3 text-sm leading-relaxed opacity-90">
            <p>{t('result.trainingNote')}</p>
            <p>{t('result.raceDayNote')}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
