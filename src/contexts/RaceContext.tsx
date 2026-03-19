import React, { createContext, useContext, useState, ReactNode } from 'react';

export type RaceSport = 'running' | 'cycling' | 'triathlon';

export interface Race {
  id: string;
  name: string;
  sport: RaceSport;
  series: string;
  location: string;
  country_code: string;
  lat: number;
  lng: number;
  date_typical: string;
  distance_km: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  net_elevation_m: number;
  altitude_start_m: number;
  altitude_finish_m: number;
  course_profile: 'flat' | 'rolling' | 'hilly' | 'mountainous' | 'extreme';
  typical_temp_c: { min: number; max: number };
  typical_humidity_pct: number;
  surface: 'road' | 'trail' | 'gravel' | 'mixed';
  notes?: string;
  swim_distance_km: number | null;
  swim_type: 'ocean' | 'lake' | 'river' | 'pool' | 'fjord' | null;
}

interface RaceContextType {
  selectedRace: Race | null;
  setSelectedRace: (race: Race | null) => void;
}

const RaceContext = createContext<RaceContextType | undefined>(undefined);

export function RaceProvider({ children }: { children: ReactNode }) {
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);

  return (
    <RaceContext.Provider value={{ selectedRace, setSelectedRace }}>
      {children}
    </RaceContext.Provider>
  );
}

export function useRace(): RaceContextType {
  const ctx = useContext(RaceContext);
  if (!ctx) {
    throw new Error('useRace must be used within a RaceProvider');
  }
  return ctx;
}

