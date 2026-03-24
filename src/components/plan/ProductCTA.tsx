import { SUPPLME_ELECTROLYTE_SPEC } from '@/types/hydration';
import { useLanguage } from '@/contexts/LanguageContext';

export function ProductCTA() {
  const { t } = useLanguage();

  return (
    <div className="border border-gray-200 rounded-lg p-5 text-center space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">SUPPLME</p>
      <p className="text-base font-bold text-[#0a0a0a]">Liquid Electrolyte Sachet</p>
      <p className="text-[12px] text-gray-500">
        30ml sachets &middot; {SUPPLME_ELECTROLYTE_SPEC.sodium}mg Sodium &middot; {SUPPLME_ELECTROLYTE_SPEC.potassium}mg Potassium &middot; {SUPPLME_ELECTROLYTE_SPEC.magnesium}mg Mg
      </p>
      <a
        href="https://www.supplme.com/products/electrolyte-28-pack-clementine-salt"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center px-6 py-2.5 bg-[#0a0a0a] text-white rounded-lg text-sm font-semibold hover:bg-[#1a1a1a] transition-colors"
      >
        {t('result.buySupplme')}
      </a>
    </div>
  );
}
