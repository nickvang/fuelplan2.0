import { Download } from 'lucide-react';

interface PlanActionButtonsProps {
  onSave: () => void;
  isSaving: boolean;
}

export function PlanActionButtons({ onSave, isSaving }: PlanActionButtonsProps) {
  return (
    <div>
      <button
        onClick={onSave}
        disabled={isSaving}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 rounded-lg text-sm font-semibold text-[#0a0a0a] hover:bg-gray-50 transition-colors min-h-[48px] disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        {isSaving ? 'Saving...' : 'Save to Device'}
      </button>
    </div>
  );
}
