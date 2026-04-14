import { useEffect, useMemo, useState } from 'react';
import { races } from '@/data/racesDatabase';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, PencilLine, MapPin } from 'lucide-react';

function useUserLocation() {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 5000, maximumAge: 600000 }
    );
  }, []);

  return location;
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Convert ISO 3166-1 alpha-2 code to emoji flag
const countryCodeToFlag = (code) => {
  if (!code || typeof code !== 'string' || code.length !== 2) return '🏁';
  const base = 0x1f1e6;
  const chars = code.toUpperCase().split('');
  const codePoints = chars.map((c) => base + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
};

const courseProfileLabel = (profile) => {
  switch (profile) {
    case 'flat':
      return 'Flat';
    case 'rolling':
      return 'Rolling';
    case 'hilly':
      return 'Hilly';
    case 'mountainous':
      return 'Mountainous';
    case 'extreme':
      return 'Extreme';
    default:
      return profile;
  }
};

const tempChipClasses = (maxTemp) => {
  if (maxTemp <= 10) {
    return 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30';
  }
  if (maxTemp >= 25) {
    return 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30';
  }
  return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
};

export function RaceSelector({ sport, selectedRaceId, onSelectRace }) {
  const [query, setQuery] = useState('');
  const userLocation = useUserLocation();

  const isSearching = query.trim().length > 0;

  const filteredRaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sportRaces = races.filter((race) => race.sport === sport);

    const withDistance = (list) => {
      if (!userLocation) return list.map((r) => ({ ...r, _dist: null }));
      return [...list]
        .map((r) => ({
          ...r,
          _dist: (r.lat != null && r.lng != null)
            ? haversineDistance(userLocation.lat, userLocation.lng, r.lat, r.lng)
            : null,
        }))
        .sort((a, b) => (a._dist ?? Infinity) - (b._dist ?? Infinity));
    };

    if (!q) {
      return withDistance(sportRaces).slice(0, 3);
    }

    const matched = sportRaces.filter((race) => {
      const haystack = `${race.name} ${race.location} ${race.series}`.toLowerCase();
      return haystack.includes(q);
    });
    return withDistance(matched);
  }, [sport, query, userLocation]);

  const handleSelectRace = (race) => {
    onSelectRace?.(race);
  };

  const handleCustomEvent = () => {
    onSelectRace?.(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Select your race
          </p>
          <p className="text-xs text-muted-foreground">
            Choose a certified event or use Custom Event to enter your own.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <Input
          placeholder="Search by race name, city or series…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="text-sm"
          style={{ paddingLeft: '2.5rem' }}
        />
      </div>

      {/* Custom Event card - always pinned at top */}
      <Card
        role="button"
        tabIndex={0}
        onClick={handleCustomEvent}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCustomEvent();
          }
        }}
        className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 bg-background/60 hover:bg-muted/60 hover:border-primary/50 ${
          !selectedRaceId ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-primary">
            <PencilLine className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Custom Event — Enter your own details
            </p>
            <p className="text-xs text-muted-foreground">
              Perfect for local races, training events or unique adventures.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant={selectedRaceId ? 'outline' : 'default'}
          className="text-xs px-3 py-1 h-8"
        >
          {selectedRaceId ? 'Use custom' : 'Selected'}
        </Button>
      </Card>

      {/* Certified races */}
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {filteredRaces.map((race) => {
          const isSelected = selectedRaceId === race.id;
          const maxTemp = race.typical_temp_c?.max ?? race.typical_temp_c?.min ?? 0;
          const tempLabel = race.typical_temp_c
            ? `${race.typical_temp_c.min}–${race.typical_temp_c.max}°C`
            : '—';
          const distanceLabel =
            race.distance_km % 1 === 0
              ? `${race.distance_km.toFixed(0)} km`
              : `${race.distance_km.toFixed(1)} km`;

          return (
            <Card
              key={race.id}
              role="button"
              tabIndex={0}
              onClick={() => handleSelectRace(race)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSelectRace(race);
                }
              }}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:border-primary/60 hover:bg-muted/60 ${
                isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {race.name}
                    </p>
                    <span className="text-base" aria-hidden>
                      {countryCodeToFlag(race.country_code)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {race.series && (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-semibold uppercase tracking-wide border-primary/40 text-primary"
                      >
                        {race.series}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground truncate">
                      {race.location}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-foreground">
                      {distanceLabel}
                    </span>
                    {race._dist != null && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-[11px] font-medium text-blue-700 dark:text-blue-300 border border-blue-500/30">
                        <MapPin className="w-3 h-3" />
                        ~{Math.round(race._dist)} km
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${tempChipClasses(
                        maxTemp
                      )}`}
                    >
                      🌡️ {tempLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                      ⛰️ {courseProfileLabel(race.course_profile)}
                    </span>
                  </div>
                </div>
                {isSelected && (
                  <span className="mt-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
                    ✓
                  </span>
                )}
              </div>
            </Card>
          );
        })}

        {filteredRaces.length === 0 && isSearching && (
          <p className="text-xs text-muted-foreground px-1 py-2">
            No races match "{query.trim()}". Use Custom Event above for any other race.
          </p>
        )}

        {!isSearching && (
          <p className="text-xs text-muted-foreground px-1 pt-1 text-center">
            {userLocation ? 'Nearest to you — search above to find more races' : 'Search above to find more races'}
          </p>
        )}
      </div>
    </div>
  );
}

