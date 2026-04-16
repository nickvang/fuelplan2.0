import { useLanguage } from '@/contexts/LanguageContext';

interface PlanFooterProps {
  onDeleteData: () => void;
  onExportData: () => void;
}

export function PlanFooter({ onDeleteData, onExportData }: PlanFooterProps) {
  const { t } = useLanguage();

  return (
    <div className="space-y-4 pt-4">
      {/* Disclaimer */}
      <div className="text-[11px] text-gray-400 leading-relaxed space-y-2">
        <p className="font-semibold text-gray-500 uppercase tracking-wide">{t('disclaimer.medicalTitle')}</p>
        <p>
          This hydration plan is generated using AI and scientific research for educational and informational purposes only.
          It is not a substitute for professional medical advice, diagnosis, or treatment.
          Always consult with a qualified healthcare provider before making changes to your hydration strategy.
        </p>
        <p>
          Supplme and its affiliates make no guarantees regarding the accuracy or efficacy of this plan.
          By using this tool, you assume all risks associated with implementing this hydration strategy.
        </p>
      </div>

      {/* Links */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-gray-400">
        <button
          onClick={onExportData}
          className="hover:text-blue-500 transition-colors underline"
        >
          {t('gdpr.exportButton')}
        </button>
        <span>&middot;</span>
        <button
          onClick={onDeleteData}
          className="hover:text-red-500 transition-colors underline"
        >
          {t('gdpr.deleteButton')}
        </button>
        <span>&middot;</span>
        <a href="/privacy" className="hover:text-gray-600 transition-colors underline">Privacy</a>
        <span>&middot;</span>
        <a href="/terms" className="hover:text-gray-600 transition-colors underline">Terms</a>
      </div>

      <p className="text-center text-[10px] text-gray-300">
        &copy; 2025 Supplme. All rights reserved.
      </p>
    </div>
  );
}
