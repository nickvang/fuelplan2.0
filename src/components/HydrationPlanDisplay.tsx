import { useState, useEffect } from 'react';
import { HydrationPlan, HydrationProfile, AIEnhancedInsights } from '@/types/hydration';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplets, Clock, TrendingUp, AlertCircle, Sparkles, ExternalLink, Calculator, BookOpen, Shield, Download } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import supplmeLogo from '@/assets/supplme-logo-2.svg';

interface HydrationPlanDisplayProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
  onReset: () => void;
  hasSmartWatchData?: boolean;
}

export function HydrationPlanDisplay({ plan, profile, onReset, hasSmartWatchData = false }: HydrationPlanDisplayProps) {
  const [aiInsights, setAiInsights] = useState<AIEnhancedInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAIInsights = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('enhance-hydration-plan', {
          body: { profile, plan, hasSmartWatchData }
        });

        if (error) throw error;
        setAiInsights(data);
      } catch (error: any) {
        console.error('Failed to fetch AI insights:', error);
        toast({
          title: "AI Enhancement Unavailable",
          description: "Showing basic plan without AI insights.",
          variant: "destructive"
        });
      } finally {
        setLoadingInsights(false);
      }
    };

    fetchAIInsights();
  }, [plan, profile, hasSmartWatchData]);

  const getConfidenceBadgeColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-green-500/10 text-green-700 border-green-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      case 'low': return 'bg-red-500/10 text-red-700 border-red-500/20';
      default: return 'bg-muted';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header with Logo */}
      <div className="text-center space-y-4 py-4">
        <div className="inline-flex items-center justify-center">
          <img src={supplmeLogo} alt="SUPPLME" className="h-48 w-auto" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Supplme Hydration Guide
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Your Personalized Hydration Plan
        </p>
        
        {/* Smartwatch Data Badge */}
        {hasSmartWatchData && (
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 px-4 py-2 rounded-full">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              Enhanced with Smartwatch Data
            </span>
          </div>
        )}
      </div>

      {/* Smartwatch Data Info Banner */}
      {hasSmartWatchData && (
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-700 dark:text-blue-400">Enhanced Accuracy with Your Data</AlertTitle>
          <AlertDescription className="text-sm">
            This plan uses your personal metrics from uploaded smartwatch files, including physiological data, sleep patterns, activity history, and recovery metrics. 
            This significantly improves accuracy compared to general estimates.
          </AlertDescription>
        </Alert>
      )}

      {/* Fluid Loss Summary */}
      <Card className="p-6 bg-accent/50 border-accent">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Estimated Fluid Loss</p>
          <p className="text-3xl font-bold">
            {(plan.totalFluidLoss / 1000).toFixed(1)} liters
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            during your {profile.sessionDuration}-hour activity
          </p>
          {hasSmartWatchData && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
              Calculated using your actual training data
            </p>
          )}
        </div>
      </Card>

      {/* Training Plan Header */}
      <div className="text-center py-4">
        <h2 className="text-2xl font-bold">Training Session Hydration Plan</h2>
        <p className="text-muted-foreground mt-2">
          For typical training sessions based on your {profile.sessionDuration}-hour {profile.disciplines?.[0] || 'activity'}
        </p>
      </div>

      {/* Three Phase Plan */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* PRE */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{plan.preActivity.timing}</span>
            </div>
            <h3 className="text-2xl font-bold">PRE</h3>
          </div>
          
          <div className="space-y-3 py-4">
            <div>
              <p className="text-sm text-muted-foreground">Water</p>
              <p className="text-xl font-semibold">{plan.preActivity.water} ml</p>
              <p className="text-xs text-muted-foreground mt-1">Drink 2 hours before activity</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supplme Sachet (30ml)</p>
              <p className="text-xl font-semibold">{plan.preActivity.electrolytes}x sachet</p>
              <p className="text-xs text-muted-foreground mt-1">Consume directly - no mixing</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Pre-hydration establishes optimal fluid balance. Start 2 hours before to allow absorption and bathroom breaks.
          </p>
        </Card>

        {/* DURING */}
        <Card className="p-6 space-y-4 border-primary bg-primary/5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">{plan.duringActivity.frequency}</span>
            </div>
            <h3 className="text-2xl font-bold">DURING</h3>
          </div>
          
          <div className="space-y-3 py-4">
            <div>
              <p className="text-sm text-muted-foreground">Water per hour</p>
              <p className="text-xl font-semibold">
                {plan.duringActivity.waterPerHour > 0 
                  ? `${plan.duringActivity.waterPerHour} ml` 
                  : 'As needed'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Sip every 15-20 minutes</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supplme per hour</p>
              <p className="text-xl font-semibold">
                {plan.duringActivity.electrolytesPerHour > 0 
                  ? `${plan.duringActivity.electrolytesPerHour}x sachet` 
                  : 'Not required'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Space out evenly during activity</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Replace 60-80% of sweat losses for optimal performance without GI distress (PMID 38732589)
          </p>
        </Card>

        {/* POST */}
        <Card className="p-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">{plan.postActivity.timing}</span>
            </div>
            <h3 className="text-2xl font-bold">POST</h3>
          </div>
          
          <div className="space-y-3 py-4">
            <div>
              <p className="text-sm text-muted-foreground">Water (150% of loss)</p>
              <p className="text-xl font-semibold">{plan.postActivity.water} ml</p>
              <p className="text-xs text-muted-foreground mt-1">Drink gradually over 4-6 hours post-activity</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supplme Sachet</p>
              <p className="text-xl font-semibold">{plan.postActivity.electrolytes}x sachet</p>
              <p className="text-xs text-muted-foreground mt-1">Take within 30 min of finishing</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Recovery hydration replaces deficit and accelerates muscle function recovery. The 150% target accounts for ongoing fluid losses during recovery.
          </p>
        </Card>
      </div>

      {/* Action Buttons - Right under the plan */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button onClick={() => window.print()} variant="default" size="lg" className="gap-2">
          <Download className="w-4 h-4" />
          Download Plan
        </Button>
      </div>

      {/* Supplme Product Info - Moved here */}
      <Card className="p-6 bg-accent/30">
        <div className="flex flex-col items-center gap-4">
          <h4 className="font-semibold text-lg">Supplme Liquid Electrolyte</h4>
          <p className="text-sm text-muted-foreground text-center">
            30ml sachets • 500mg Sodium • 250mg Potassium • 100mg Magnesium • 1380mg Citrate • 230mg Chloride
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Drink directly from sachet - no mixing required
          </p>
          <Button variant="default" size="lg" asChild className="w-full sm:w-auto">
            <a href="https://www.supplme.com" target="_blank" rel="noopener noreferrer">
              Buy Supplme
            </a>
          </Button>
        </div>
      </Card>

      {/* Race Day Hydration Guide */}
      {profile.upcomingEvents && (
        <div className="space-y-6">
          <div className="text-center py-4">
            <h2 className="text-2xl font-bold">Race Day Hydration Plan</h2>
            <p className="text-muted-foreground mt-2">
              For your upcoming: <strong>{profile.upcomingEvents}</strong>
            </p>
          </div>

          <Card className="p-6 bg-primary/5 border-primary/20">
            <h3 className="text-xl font-semibold mb-4">Race Day Strategy</h3>
            
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Race Adjustments</AlertTitle>
              <AlertDescription>
                Race intensity is typically 10-15% higher than training, increasing fluid needs. 
                Nervousness and adrenaline also increase fluid loss. Practice this strategy during training!
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="bg-background p-4 rounded-lg">
                <h4 className="font-semibold mb-3">Pre-Race (Day Before & Morning)</h4>
                <ul className="space-y-2 text-sm">
                  <li>• Day before: Maintain normal hydration + {plan.preActivity.water}ml extra</li>
                  <li>• 2 hours before start: {plan.preActivity.water}ml water + <strong>{plan.preActivity.electrolytes}x Supplme sachet</strong></li>
                  <li>• 30 min before start: 200-300ml water (sips only)</li>
                </ul>
              </div>

              <div className="bg-background p-4 rounded-lg">
                <h4 className="font-semibold mb-3">During Race - Supplme Sachet Schedule</h4>
                {profile.disciplines?.[0] === 'Triathlon' ? (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">For Triathlon:</p>
                    <ul className="space-y-2 text-sm">
                      <li>• <strong>Swim:</strong> Pre-loaded from pre-race sachet</li>
                      <li>• <strong>T1 Transition:</strong> Take 1 Supplme sachet</li>
                      <li>• <strong>Bike:</strong> 1 sachet every 45-60 minutes + {Math.round(plan.duringActivity.waterPerHour * 0.85)}ml water/hour</li>
                      <li>• <strong>T2 Transition:</strong> Take 1 Supplme sachet</li>
                      <li>• <strong>Run:</strong> 1 sachet every 30-45 minutes at aid stations + water as tolerated</li>
                    </ul>
                  </div>
                ) : profile.disciplines?.[0] === 'Run' ? (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Every 30 minutes:</strong> 1 Supplme sachet at aid station</li>
                    <li>• Drink {Math.round(plan.duringActivity.waterPerHour / 2)}ml water every 15 minutes</li>
                    <li>• For marathons: Aim for 3-4 sachets total during race</li>
                    <li>• For ultras: 1 sachet per hour minimum</li>
                  </ul>
                ) : profile.disciplines?.[0] === 'Bike' ? (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Every 45-60 minutes:</strong> 1 Supplme sachet</li>
                    <li>• Drink {plan.duringActivity.waterPerHour}ml water per hour in small sips</li>
                    <li>• Keep sachets in jersey pocket or bike bag for easy access</li>
                  </ul>
                ) : (
                  <ul className="space-y-2 text-sm">
                    <li>• <strong>Every 30-45 minutes:</strong> 1 Supplme sachet</li>
                    <li>• Drink {plan.duringActivity.waterPerHour}ml water per hour</li>
                    <li>• Adjust based on aid station availability</li>
                  </ul>
                )}
              </div>

              <div className="bg-background p-4 rounded-lg">
                <h4 className="font-semibold mb-3">Post-Race Recovery</h4>
                <ul className="space-y-2 text-sm">
                  <li>• Within 30 minutes: <strong>{plan.postActivity.electrolytes}x Supplme sachets</strong> + {Math.round(plan.postActivity.water / 2)}ml water</li>
                  <li>• Next 2-4 hours: Remaining {Math.round(plan.postActivity.water / 2)}ml water gradually</li>
                  <li>• Monitor urine color - aim for pale yellow</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Fluid Loss Line Graph */}
      <Card className="p-6">
        <h3 className="text-xl font-semibold mb-6">Fluid Loss Rate (Training)</h3>
        <div className="space-y-4">
          <div className="relative h-64 bg-muted/30 rounded-lg p-6">
            <svg width="100%" height="100%" viewBox="0 0 600 200" className="overflow-visible">
              {/* Grid lines */}
              <line x1="50" y1="180" x2="550" y2="180" stroke="currentColor" strokeOpacity="0.2" />
              <line x1="50" y1="135" x2="550" y2="135" stroke="currentColor" strokeOpacity="0.2" />
              <line x1="50" y1="90" x2="550" y2="90" stroke="currentColor" strokeOpacity="0.2" />
              <line x1="50" y1="45" x2="550" y2="45" stroke="currentColor" strokeOpacity="0.2" />
              
              {/* Axes */}
              <line x1="50" y1="10" x2="50" y2="180" stroke="currentColor" strokeWidth="2" />
              <line x1="50" y1="180" x2="550" y2="180" stroke="currentColor" strokeWidth="2" />
              
              {/* Y-axis labels */}
              <text x="40" y="185" textAnchor="end" fontSize="12" fill="currentColor">0</text>
              <text x="40" y="140" textAnchor="end" fontSize="12" fill="currentColor">{Math.round(plan.totalFluidLoss / profile.sessionDuration / 4)}ml</text>
              <text x="40" y="95" textAnchor="end" fontSize="12" fill="currentColor">{Math.round(plan.totalFluidLoss / profile.sessionDuration / 2)}ml</text>
              <text x="40" y="50" textAnchor="end" fontSize="12" fill="currentColor">{Math.round(plan.totalFluidLoss / profile.sessionDuration * 0.75)}ml</text>
              <text x="40" y="15" textAnchor="end" fontSize="12" fill="currentColor">{Math.round(plan.totalFluidLoss / profile.sessionDuration)}ml</text>
              
              {/* X-axis labels */}
              {Array.from({ length: Math.ceil(profile.sessionDuration) + 1 }).map((_, i) => (
                <text key={i} x={50 + (i * 500 / profile.sessionDuration)} y="195" textAnchor="middle" fontSize="12" fill="currentColor">
                  {i}h
                </text>
              ))}
              
              {/* Line graph */}
              <polyline
                points={Array.from({ length: Math.ceil(profile.sessionDuration * 4) + 1 })
                  .map((_, i) => {
                    const x = 50 + (i * 500 / (profile.sessionDuration * 4));
                    const y = 180 - ((Math.round(plan.totalFluidLoss / profile.sessionDuration) / Math.round(plan.totalFluidLoss / profile.sessionDuration)) * 170 * (i / (profile.sessionDuration * 4)));
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="3"
              />
            </svg>
          </div>
          <p className="text-sm text-center text-muted-foreground">
            Cumulative fluid loss over {profile.sessionDuration} hours: <strong>{(plan.totalFluidLoss / 1000).toFixed(2)}L</strong>
          </p>
        </div>
      </Card>

      {/* AI Insights Section - Moved after plans */}
      {aiInsights && (
        <Card className="p-6 border-2 border-primary/20 bg-primary/5">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">AI-Enhanced Analysis</h3>
              <span className={`ml-auto text-xs px-3 py-1 rounded-full border ${getConfidenceBadgeColor(aiInsights.confidence_level)}`}>
                {aiInsights.confidence_level.toUpperCase()} CONFIDENCE
              </span>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Why These Numbers?</h4>
                <p className="text-sm leading-relaxed">{aiInsights.personalized_insight}</p>
              </div>

              {aiInsights.performance_comparison && (
                <div className="bg-accent/50 border border-accent p-3 rounded-lg">
                  <h4 className="font-medium text-sm text-muted-foreground mb-1">Performance Comparison</h4>
                  <p className="text-sm leading-relaxed">{aiInsights.performance_comparison}</p>
                </div>
              )}

              {aiInsights.optimization_tips && aiInsights.optimization_tips.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm text-muted-foreground mb-2">Optimization Tips</h4>
                  <ul className="space-y-2">
                    {aiInsights.optimization_tips.map((tip, index) => (
                      <li key={index} className="flex gap-2 text-sm">
                        <span className="text-primary">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {aiInsights.risk_factors && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Key Risk Factors</AlertTitle>
                  <AlertDescription>{aiInsights.risk_factors}</AlertDescription>
                </Alert>
              )}
              
              {aiInsights.professional_recommendation && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong>Professional Recommendation:</strong> {aiInsights.professional_recommendation}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {loadingInsights && (
        <Card className="p-6 border-2 border-primary/20">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Generating AI-enhanced insights...</p>
          </div>
        </Card>
      )}

      {/* Calculation Transparency */}
      <Card className="p-6">
        <Accordion type="single" collapsible>
          <AccordionItem value="calculations">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                <span className="font-semibold">How We Calculated Your Plan</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-2">
                {plan.calculationSteps.map((step, index) => (
                  <div key={index} className="flex gap-3 text-sm">
                    <span className="text-primary font-mono">{index + 1}.</span>
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </Card>

      {/* Recommendations */}
      <Card className="p-6 space-y-4">
        <h3 className="text-xl font-semibold">Personalized Recommendations</h3>
        <ul className="space-y-3">
          {plan.recommendations.map((rec, index) => (
            <li key={index} className="flex gap-3 text-muted-foreground">
              <span className="text-primary mt-1">•</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Scientific References */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Scientific References</h3>
        </div>
        <div className="space-y-3">
          {plan.scientificReferences.map((ref) => (
            <div key={ref.pmid} className="border-l-2 border-primary/30 pl-4 py-2">
              <p className="font-medium text-sm">{ref.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{ref.citation}</p>
              <a 
                href={ref.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
              >
                View on PubMed <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      </Card>

      {/* Final action button */}
      <div className="flex justify-center">
        <Button onClick={onReset} variant="outline" size="lg">
          Create New Plan
        </Button>
      </div>

      {/* Medical Disclaimer - Moved to bottom */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Medical & Professional Disclaimer</AlertTitle>
        <AlertDescription className="space-y-2 text-sm">
          <p>
            This hydration plan is generated using AI and scientific research for educational and informational purposes only. 
            It is <strong>not a substitute for professional medical advice, diagnosis, or treatment</strong>.
          </p>
          <p>
            Individual hydration needs vary significantly based on genetics, acclimatization, health conditions, and other factors. 
            Always consult with a qualified sports nutritionist, physician, or healthcare provider before making changes to your hydration strategy, 
            especially if you have medical conditions or take medications.
          </p>
          <p>
            For the most accurate personalized recommendations, consider professional sweat testing and consultation with a sports dietitian.
          </p>
        </AlertDescription>
      </Alert>

      {/* Legal Disclaimer */}
      <Card className="p-6 bg-muted/30 border-dashed">
        <div className="space-y-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">LEGAL DISCLAIMER</p>
          <p>
            Supplme and its affiliates make no guarantees, warranties, or representations regarding the accuracy, completeness, 
            or efficacy of this hydration plan. Results may vary, and performance improvements are not guaranteed.
          </p>
          <p>
            By using this tool, you acknowledge that Supplme shall not be held liable for any injuries, health issues, 
            performance outcomes, or other consequences resulting from following these recommendations. You assume all risks 
            associated with implementing this hydration strategy.
          </p>
          <p>
            This tool uses artificial intelligence which may produce errors or inaccuracies. All recommendations should be 
            verified with qualified professionals before implementation.
          </p>
          <p>
            Supplme products are dietary supplements and have not been evaluated by the FDA. These products are not intended 
            to diagnose, treat, cure, or prevent any disease.
          </p>
          <p className="pt-2 text-center">
            © 2025 Supplme. All rights reserved. Use of this tool constitutes acceptance of these terms.
          </p>
        </div>
      </Card>
    </div>
  );
}
