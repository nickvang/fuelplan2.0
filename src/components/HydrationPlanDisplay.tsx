import { useState, useEffect } from 'react';
import { HydrationPlan, HydrationProfile, AIEnhancedInsights } from '@/types/hydration';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplets, Clock, TrendingUp, AlertCircle, Sparkles, ExternalLink, Calculator, BookOpen, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface HydrationPlanDisplayProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
  onReset: () => void;
}

export function HydrationPlanDisplay({ plan, profile, onReset }: HydrationPlanDisplayProps) {
  const [aiInsights, setAiInsights] = useState<AIEnhancedInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAIInsights = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('enhance-hydration-plan', {
          body: { profile, plan }
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
  }, [plan, profile]);

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
      {/* Header */}
      <div className="text-center space-y-4 py-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Droplets className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Your Personalized Hydration Plan
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Science-backed hydration strategy optimized for your performance
        </p>
      </div>

      {/* AI Insights Section */}
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
            
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-sm text-muted-foreground mb-1">Why These Numbers?</h4>
                <p className="text-sm leading-relaxed">{aiInsights.personalized_insight}</p>
              </div>
              
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
        </div>
      </Card>

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
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supplme Sachet (30ml)</p>
              <p className="text-xl font-semibold">{plan.preActivity.electrolytes}x sachet</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Pre-hydration establishes optimal fluid balance before activity begins
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
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supplme per hour</p>
              <p className="text-xl font-semibold">
                {plan.duringActivity.electrolytesPerHour > 0 
                  ? `${plan.duringActivity.electrolytesPerHour}x sachet` 
                  : 'Not required'}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Replace 60-80% of sweat losses to maintain performance (PMID 38732589)
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
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Supplme Sachet</p>
              <p className="text-xl font-semibold">{plan.postActivity.electrolytes}x sachet</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Recovery hydration replaces deficit and accelerates muscle function recovery
          </p>
        </Card>
      </div>

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

      {/* Medical Disclaimer */}
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

      {/* Supplme Product Info */}
      <Card className="p-6 bg-accent/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Supplme Liquid Electrolyte</h4>
            <p className="text-sm text-muted-foreground">
              30ml sachets • 500mg Sodium • 250mg Potassium • 100mg Magnesium • 1380mg Citrate • 230mg Chloride
            </p>
            <p className="text-xs text-muted-foreground">
              Drink directly from sachet - no mixing required
            </p>
          </div>
          <Button variant="default" size="lg" asChild>
            <a href="https://www.supplme.com" target="_blank" rel="noopener noreferrer">
              Shop Supplme
            </a>
          </Button>
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
        <Button onClick={onReset} variant="outline" size="lg">
          Create New Plan
        </Button>
        <Button onClick={() => window.print()} variant="default" size="lg">
          Print Plan
        </Button>
      </div>
    </div>
  );
}
