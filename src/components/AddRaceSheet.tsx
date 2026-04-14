import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { races } from '@/data/racesDatabase';
import { Search } from 'lucide-react';

interface AddRaceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRaceAdded: () => void;
}

interface RaceSuggestion {
  id: string;
  name: string;
  distance_km: number;
  sport: string;
  location: string;
  country_code: string;
  lat: number | null;
  lng: number | null;
}

export function AddRaceSheet({ open, onOpenChange, onRaceAdded }: AddRaceSheetProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [raceName, setRaceName] = useState('');
  const [raceDate, setRaceDate] = useState<Date | undefined>(undefined);
  const [distanceKm, setDistanceKm] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions: RaceSuggestion[] = searchQuery.trim().length >= 2
    ? (races as RaceSuggestion[])
        .filter((r) => {
          const haystack = `${r.name} ${r.location}`.toLowerCase();
          return haystack.includes(searchQuery.trim().toLowerCase());
        })
        .slice(0, 5)
    : [];

  const handleSelectSuggestion = (race: RaceSuggestion) => {
    setRaceName(race.name);
    setSearchQuery(race.name);
    setShowSuggestions(false);

    if (race.distance_km) setDistanceKm(String(race.distance_km));

    // Map sport to discipline
    const sportMap: Record<string, string> = {
      running: 'Running', cycling: 'Cycling', triathlon: 'Triathlon', swimming: 'Swimming',
    };
    if (race.sport) setDiscipline(sportMap[race.sport] || race.sport);

    if (race.location) {
      const parts = race.location.split(',').map((s) => s.trim());
      if (parts.length >= 1) setLocationCity(parts[0]);
      if (parts.length >= 2) setLocationCountry(parts[parts.length - 1]);
    }
    if (race.lat != null) setLatitude(race.lat);
    if (race.lng != null) setLongitude(race.lng);
  };

  const handleSave = async () => {
    if (!user || !raceName.trim() || !raceDate) return;
    setSaving(true);

    const dateStr = raceDate.toISOString().split('T')[0];

    const { error } = await supabase.from('athlete_races').insert({
      user_id: user.id,
      race_name: raceName.trim(),
      race_date: dateStr,
      distance_km: distanceKm ? Number(distanceKm) : null,
      discipline: discipline || null,
      location_city: locationCity || null,
      location_country: locationCountry || null,
      latitude,
      longitude,
    });

    setSaving(false);

    if (!error) {
      // Reset form
      setRaceName('');
      setRaceDate(undefined);
      setDistanceKm('');
      setDiscipline('');
      setLocationCity('');
      setLocationCountry('');
      setLatitude(null);
      setLongitude(null);
      setSearchQuery('');
      onRaceAdded();
      onOpenChange(false);
    }
  };

  const isValid = raceName.trim().length > 0 && raceDate != null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="text-left">
          <SheetTitle className="text-lg font-bold text-[#0a0a0a]">{t('race.addTitle')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-4">
          {/* Race name with search */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-[#0a0a0a]">{t('race.name')}</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setRaceName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder={t('race.namePlaceholder')}
                className="pl-10 min-h-[48px] text-base"
              />
            </div>
            {/* Suggestions dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {suggestions.map((race) => (
                  <button
                    key={race.id}
                    type="button"
                    className="w-full text-left px-3.5 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                    onClick={() => handleSelectSuggestion(race)}
                  >
                    <p className="text-[13px] font-medium text-[#0a0a0a]">{race.name}</p>
                    <p className="text-[11px] text-gray-400">
                      {race.location} · {race.distance_km}km
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold text-[#0a0a0a]">{t('race.date')}</Label>
            <div className="border border-gray-200 rounded-lg overflow-hidden flex justify-center">
              <Calendar
                mode="single"
                selected={raceDate}
                onSelect={setRaceDate}
                disabled={{ before: new Date() }}
                className="!p-2"
              />
            </div>
          </div>

          {/* Optional details */}
          <Accordion type="single" collapsible>
            <AccordionItem value="details" className="border-none">
              <AccordionTrigger className="hover:no-underline py-2 text-[13px] font-semibold text-gray-400">
                {t('race.moreDetails')}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-gray-500">{t('race.distance')}</Label>
                      <Input
                        type="number"
                        value={distanceKm}
                        onChange={(e) => setDistanceKm(e.target.value)}
                        placeholder="42.2"
                        className="min-h-[48px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-gray-500">{t('race.discipline')}</Label>
                      <Input
                        value={discipline}
                        onChange={(e) => setDiscipline(e.target.value)}
                        placeholder="Running"
                        className="min-h-[48px]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-gray-500">{t('race.city')}</Label>
                      <Input
                        value={locationCity}
                        onChange={(e) => setLocationCity(e.target.value)}
                        placeholder="Copenhagen"
                        className="min-h-[48px]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] text-gray-500">{t('race.country')}</Label>
                      <Input
                        value={locationCountry}
                        onChange={(e) => setLocationCountry(e.target.value)}
                        placeholder="Denmark"
                        className="min-h-[48px]"
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Save button */}
          <Button
            className="w-full min-h-[48px] text-base bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]"
            disabled={!isValid || saving}
            onClick={handleSave}
          >
            {saving ? t('race.saving') : t('race.save')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
