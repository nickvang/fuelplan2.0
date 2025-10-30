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
        className="h-8 px-3 text-xs"
      >
        English
      </Button>
      <Button
        variant={language === 'da' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('da')}
        className="h-8 px-3 text-xs"
      >
        Dansk
      </Button>
    </div>
  );
}
