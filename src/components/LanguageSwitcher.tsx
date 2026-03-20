import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-1">
      <Globe className="w-4 h-4 text-muted-foreground ml-2" />
      <Button
        variant={language === 'en' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('en')}
        className="min-h-[44px] px-3 text-xs touch-manipulation"
      >
        English
      </Button>
      <Button
        variant={language === 'da' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('da')}
        className="min-h-[44px] px-3 text-xs touch-manipulation"
      >
        Dansk
      </Button>
    </div>
  );
}
