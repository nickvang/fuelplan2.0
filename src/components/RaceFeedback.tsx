import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { X, ArrowRight, Check } from 'lucide-react';

interface RaceFeedbackProps {
  raceId: string;
  raceName: string;
  planId: string | null;
  onClose: () => void;
  onSubmitted: () => void;
}

const ISSUE_OPTIONS = [
  'cramping',
  'gi_distress',
  'dehydration',
  'overhydration',
  'bonking',
  'nausea',
] as const;

type FeedbackDirection = 'too_much' | 'just_right' | 'too_little';

export function RaceFeedback({ raceId, raceName, planId, onClose, onSubmitted }: RaceFeedbackProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [rating, setRating] = useState<number>(0);
  const [issues, setIssues] = useState<string[]>([]);
  const [waterFeedback, setWaterFeedback] = useState<FeedbackDirection | null>(null);
  const [sodiumFeedback, setSodiumFeedback] = useState<FeedbackDirection | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const toggleIssue = (issue: string) => {
    setIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    );
  };

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setSaving(true);

    // Save to race_feedback
    await supabase.from('race_feedback').insert({
      user_id: user.id,
      race_id: raceId,
      plan_id: planId,
      overall_rating: rating,
      issues,
      water_feedback: waterFeedback,
      sodium_feedback: sodiumFeedback,
      notes: notes.trim() || null,
    });

    // Update calibration via edge function (Bayesian coefficients + issue-driven modifiers)
    await supabase.functions.invoke('submit-plan-feedback', {
      body: {
        user_id: user.id,
        water_feedback: waterFeedback || 'just_right',
        sodium_feedback: sodiumFeedback || 'just_right',
        sweat_feedback: issues.includes('dehydration')
          ? 'too_little'
          : issues.includes('overhydration')
          ? 'too_much'
          : 'just_right',
        pre_water_feedback: 'just_right',
        condition: issues[0] || undefined,
        condition_outcome: rating >= 4 ? 'better' : rating <= 2 ? 'worse' : 'same',
        issues,
        overall_rating: rating,
      },
    });

    // Mark race as completed
    await supabase
      .from('athlete_races')
      .update({ status: 'completed' })
      .eq('id', raceId);

    setSaving(false);
    setDone(true);
  };

  // Done state
  if (done) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center px-6">
        <div className="text-center space-y-4 animate-in fade-in duration-300">
          <div className="w-16 h-16 rounded-full bg-[#0a0a0a] flex items-center justify-center mx-auto">
            <Check className="w-8 h-8 text-white" />
          </div>
          <p className="text-xl font-bold text-[#0a0a0a]">{t('feedback.thanks')}</p>
          <p className="text-[13px] text-gray-500 max-w-[260px] mx-auto">{t('feedback.thanksDescription')}</p>
          <Button
            className="mt-4 bg-[#0a0a0a] text-white hover:bg-[#1a1a1a] min-h-[48px]"
            onClick={() => { onSubmitted(); onClose(); }}
          >
            {t('feedback.done')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] pb-3 border-b border-gray-100">
        <p className="text-[13px] font-semibold text-gray-400 uppercase tracking-widest">
          {step === 1 ? t('feedback.step1of2') : t('feedback.step2of2')}
        </p>
        <button onClick={onClose} className="p-2 -mr-2 text-gray-400 hover:text-black min-w-[48px] min-h-[48px] flex items-center justify-center">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {step === 1 ? (
          <div className="space-y-6 max-w-md mx-auto">
            <div>
              <p className="text-lg font-bold text-[#0a0a0a]">{t('feedback.howDidItGo')}</p>
              <p className="text-[13px] text-gray-400 mt-1">{raceName}</p>
            </div>

            {/* Star rating */}
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[#0a0a0a]">{t('feedback.overallRating')}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    className={`w-14 h-14 rounded-lg border-2 text-lg font-bold transition-colors ${
                      rating === n
                        ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                        : 'border-gray-200 text-[#0a0a0a] hover:border-gray-400'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[11px] text-gray-400 px-1">
                <span>{t('feedback.ratingBad')}</span>
                <span>{t('feedback.ratingGreat')}</span>
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[#0a0a0a]">{t('feedback.anyIssues')}</p>
              <div className="flex flex-wrap gap-2">
                {ISSUE_OPTIONS.map((issue) => (
                  <button
                    key={issue}
                    onClick={() => toggleIssue(issue)}
                    className={`px-3.5 py-2 rounded-full text-[13px] font-medium border transition-colors min-h-[40px] ${
                      issues.includes(issue)
                        ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                        : 'border-gray-200 text-[#0a0a0a] hover:border-gray-400'
                    }`}
                  >
                    {t(`feedback.issue.${issue}`)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-md mx-auto">
            <div>
              <p className="text-lg font-bold text-[#0a0a0a]">{t('feedback.finetuneTitle')}</p>
              <p className="text-[13px] text-gray-400 mt-1">{t('feedback.finetuneDescription')}</p>
            </div>

            {/* Water feedback */}
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[#0a0a0a]">{t('feedback.waterQuestion')}</p>
              <div className="flex gap-2">
                {(['too_little', 'just_right', 'too_much'] as FeedbackDirection[]).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => setWaterFeedback(dir)}
                    className={`flex-1 px-3 py-3 rounded-lg text-[13px] font-medium border transition-colors min-h-[48px] ${
                      waterFeedback === dir
                        ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                        : 'border-gray-200 text-[#0a0a0a] hover:border-gray-400'
                    }`}
                  >
                    {t(`feedback.${dir}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Sodium feedback */}
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[#0a0a0a]">{t('feedback.sodiumQuestion')}</p>
              <div className="flex gap-2">
                {(['too_little', 'just_right', 'too_much'] as FeedbackDirection[]).map((dir) => (
                  <button
                    key={dir}
                    onClick={() => setSodiumFeedback(dir)}
                    className={`flex-1 px-3 py-3 rounded-lg text-[13px] font-medium border transition-colors min-h-[48px] ${
                      sodiumFeedback === dir
                        ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                        : 'border-gray-200 text-[#0a0a0a] hover:border-gray-400'
                    }`}
                  >
                    {t(`feedback.${dir}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <p className="text-[13px] font-semibold text-[#0a0a0a]">{t('feedback.notes')}</p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('feedback.notesPlaceholder')}
                className="min-h-[80px] text-base resize-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-gray-100">
        {step === 1 ? (
          <Button
            className="w-full min-h-[48px] text-base gap-2 bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]"
            disabled={rating === 0}
            onClick={() => setStep(2)}
          >
            {t('feedback.next')}
            <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="min-h-[48px] border-gray-200 text-[#0a0a0a]"
              onClick={() => setStep(1)}
            >
              {t('feedback.back')}
            </Button>
            <Button
              className="flex-1 min-h-[48px] text-base bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]"
              disabled={saving}
              onClick={handleSubmit}
            >
              {saving ? t('feedback.submitting') : t('feedback.submit')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
