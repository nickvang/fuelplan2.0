import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HydrationPlan, HydrationProfile, SUPPLME_GEL_SPEC } from '@/types/hydration';

interface EnergyGelSectionProps {
  plan: HydrationPlan;
  profile: HydrationProfile;
}

export function EnergyGelSection({ plan }: EnergyGelSectionProps) {
  const gel = plan.energyGel;
  const { carbsPerGel, ratioLabel, volumeMl, kcalPerGel } = SUPPLME_GEL_SPEC;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#111111' }}>
      {/* Header label — mirrors SachetSummaryCard */}
      <div className="px-3.5 py-2.5 border-b" style={{ borderColor: '#2a2a2a', background: '#0d0d0d' }}>
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#888' }}>
          {gel.applicable
            ? `Energy Gel sachet summary / ${gel.totalGels} total`
            : 'Energy Gel sachet summary'}
        </p>
      </div>

      <div className="p-5 sm:p-6 flex flex-col items-center gap-5 text-center">

        {/* Title */}
        <div className="space-y-1.5">
          <h4 className="text-xl font-bold text-white tracking-tight">
            Supplme Liquid Energy Gel
          </h4>
          <p className="text-sm" style={{ color: '#888' }}>
            {volumeMl}ml · {carbsPerGel}g carbs · {ratioLabel} glucose:fructose · liposomal delivery
          </p>
        </div>

        {gel.applicable ? (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
              {[
                { value: gel.totalGels, label: 'Total Gels' },
                { value: `${gel.totalCarbsG}g`, label: 'Carbs' },
                { value: gel.totalKcal, label: 'Kcal' },
              ].map(({ value, label }) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center py-4 px-2 rounded-lg"
                  style={{ background: '#1e1e1e', border: '1px solid #2a2a2a' }}
                >
                  <span className="text-2xl sm:text-3xl font-bold text-white leading-none">{value}</span>
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wide mt-2"
                    style={{ color: '#888' }}
                  >
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* When to take */}
            <div
              className="w-full text-left rounded-lg p-4 space-y-2"
              style={{ border: '1px solid #2a2a2a', background: '#161616' }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: '#666' }}
              >
                When to take
              </p>
              <p className="text-sm font-medium text-white leading-relaxed">
                {gel.timing}
              </p>
              <p className="text-xs" style={{ color: '#777' }}>
                Always take with water to aid absorption and reduce GI stress.
              </p>
            </div>

            {/* No-mix note */}
            <p className="text-sm font-medium" style={{ color: '#aaa' }}>
              Drink directly from sachet — no mixing required
            </p>

            {/* Buy button */}
            <Button
              variant="default"
              size="lg"
              className="w-full sm:w-auto min-h-[48px] touch-manipulation bg-white text-black hover:bg-gray-100 font-semibold"
              asChild
            >
              <a
                href="https://supplme.com/products/energy-gel"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Buy Energy Gel
              </a>
            </Button>
          </>
        ) : (
          <>
            {/* Not applicable — minimal */}
            <div
              className="w-full rounded-lg p-4 space-y-1.5"
              style={{ border: '1px solid #2a2a2a', background: '#161616' }}
            >
              <p className="text-sm font-medium text-white">{gel.timing}</p>
            </div>
            <p className="text-xs italic" style={{ color: '#666' }}>
              {gel.pubmedBasis}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
