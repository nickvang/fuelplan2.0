import { HydrationPlan } from '@/types/hydration';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Droplets, Clock, TrendingUp } from 'lucide-react';

interface HydrationPlanDisplayProps {
  plan: HydrationPlan;
  onReset: () => void;
}

export function HydrationPlanDisplay({ plan, onReset }: HydrationPlanDisplayProps) {
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

      {/* Fluid Loss Summary */}
      <Card className="p-6 bg-accent/50 border-accent">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">Estimated Fluid Loss</p>
          <p className="text-3xl font-bold">
            {(plan.totalFluidLoss / 1000).toFixed(1)} liters
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            per hour of activity
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
              <p className="text-sm text-muted-foreground">Supplme Electrolyte</p>
              <p className="text-xl font-semibold">{plan.preActivity.electrolytes}x dose</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Pre-hydration helps establish optimal fluid balance before activity begins
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
                  ? `${plan.duringActivity.electrolytesPerHour}x dose` 
                  : 'Not required'}
              </p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Maintain consistent intake to replace fluids and electrolytes lost through sweat
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
              <p className="text-sm text-muted-foreground">Supplme Electrolyte</p>
              <p className="text-xl font-semibold">{plan.postActivity.electrolytes}x dose</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground border-t border-border pt-4">
            Recovery hydration replaces fluid deficit and supports muscle function
          </p>
        </Card>
      </div>

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

      {/* Supplme Product Info */}
      <Card className="p-6 bg-accent/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Supplme Liquid Electrolyte</h4>
            <p className="text-sm text-muted-foreground">
              500mg Sodium · 250mg Potassium · 100mg Magnesium · 1380mg Citrate · 230mg Chloride
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
